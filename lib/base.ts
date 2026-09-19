// LA BASE PROPIA DEL PANEL (Postgres en Vercel / Neon)
//
// Acá se guarda lo que la ingesta trae una vez al día. Las vistas leen de
// aquí y nunca de las APIs: por eso abren al instante y no gastan cupo.
// Esquema en db/esquema.sql; decisiones en docs/ARQUITECTURA.md.

import { neon } from "@neondatabase/serverless";
import type { DiaCampana } from "./datos";

// Vercel nombra la variable según el prefijo que se elija al conectar la base;
// se aceptan los nombres habituales para no depender de ese detalle.
const url = () =>
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.STORAGE_URL ?? process.env.NEON_DATABASE_URL ?? "";

export const baseConectada = () => Boolean(url());

function sql() {
  const u = url();
  if (!u) throw new Error("Falta DATABASE_URL: la base de Vercel no está conectada.");
  return neon(u);
}

// ── Escritura (la usa la ingesta) ────────────────────────────
/** Guarda campañas por día; si el día ya existía, lo reemplaza. */
export async function guardarCampanaDia(filas: DiaCampana[]) {
  if (!filas.length) return 0;
  const q = sql();
  // Neon acepta una consulta por llamada; van en tandas de 200 filas.
  for (let i = 0; i < filas.length; i += 200) {
    const tanda = filas.slice(i, i + 200);
    await q.query(
      `insert into panel.campana_dia
         (fecha, canal, campana, inversion, impresiones, alcance, clics, leads, intenciones, actualizado_en)
       select * from unnest($1::date[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[], $7::int[], $8::int[], $9::int[], $10::timestamptz[])
       on conflict (fecha, canal, campana) do update set
         inversion = excluded.inversion, impresiones = excluded.impresiones, alcance = excluded.alcance,
         clics = excluded.clics, leads = excluded.leads, intenciones = excluded.intenciones,
         actualizado_en = excluded.actualizado_en`,
      [
        tanda.map((f) => f.fecha), tanda.map((f) => f.canal), tanda.map((f) => f.campana),
        tanda.map((f) => f.inversion), tanda.map((f) => f.impresiones), tanda.map((f) => f.alcance),
        tanda.map((f) => f.clics), tanda.map((f) => f.leads ?? null), tanda.map((f) => f.intenciones ?? null),
        tanda.map(() => new Date().toISOString()),
      ],
    );
  }
  return filas.length;
}

export type FilaDesglose = { fecha: string; tipo: string; clave: string; a: number; b: number; c: number };

/** Guarda desgloses (sitio o Meta) en la tabla que corresponda. Las tres
 *  cifras significan sesiones/personas/conversiones en el sitio y
 *  gasto/conversaciones/contactos en Meta. */
export async function guardarDesglose(tabla: "sitio_desglose" | "meta_desglose", filas: FilaDesglose[]) {
  if (!filas.length) return 0;
  const q = sql();
  const cols = tabla === "sitio_desglose" ? "sesiones, personas, conversiones" : "gasto, conversaciones, contactos";
  const [c1, c2, c3] = cols.split(", ");
  for (let i = 0; i < filas.length; i += 300) {
    const tanda = filas.slice(i, i + 300);
    await q.query(
      `insert into panel.${tabla} (fecha, tipo, clave, ${cols}, actualizado_en)
       select * from unnest($1::date[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[], $7::timestamptz[])
       on conflict (fecha, tipo, clave) do update set
         ${c1} = excluded.${c1}, ${c2} = excluded.${c2}, ${c3} = excluded.${c3}, actualizado_en = excluded.actualizado_en`,
      [
        tanda.map((f) => f.fecha), tanda.map((f) => f.tipo), tanda.map((f) => f.clave),
        tanda.map((f) => f.a), tanda.map((f) => f.b), tanda.map((f) => f.c),
        tanda.map(() => new Date().toISOString()),
      ],
    );
  }
  return filas.length;
}

export type FilaSitioDia = {
  fecha: string; personas: number; nuevos: number; sesiones: number;
  interactivas: number; conversiones: number; duracionMedia: number;
};

export async function guardarSitioDia(filas: FilaSitioDia[]) {
  if (!filas.length) return 0;
  await sql().query(
    `insert into panel.sitio_dia (fecha, personas, nuevos, sesiones, interactivas, conversiones, duracion_media, actualizado_en)
     select * from unnest($1::date[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[], $7::real[], $8::timestamptz[])
     on conflict (fecha) do update set
       personas = excluded.personas, nuevos = excluded.nuevos, sesiones = excluded.sesiones,
       interactivas = excluded.interactivas, conversiones = excluded.conversiones,
       duracion_media = excluded.duracion_media, actualizado_en = excluded.actualizado_en`,
    [
      filas.map((f) => f.fecha), filas.map((f) => f.personas), filas.map((f) => f.nuevos), filas.map((f) => f.sesiones),
      filas.map((f) => f.interactivas), filas.map((f) => f.conversiones), filas.map((f) => f.duracionMedia),
      filas.map(() => new Date().toISOString()),
    ],
  );
  return filas.length;
}

/** Anota una corrida de ingesta, buena o mala, para que Medición la muestre. */
export async function registrarIngesta(r: {
  fuente: string; desde: string; hasta: string; filas: number; error?: string | null; inicio: Date;
}) {
  await sql().query(
    `insert into panel.ingesta (fuente, desde, hasta, filas, estado, error, inicio, fin)
     values ($1, $2, $3, $4, $5, $6, $7, now())`,
    [r.fuente, r.desde, r.hasta, r.filas, r.error ? "error" : "ok", r.error ?? null, r.inicio.toISOString()],
  );
}

// ── Lectura (la usan las vistas) ─────────────────────────────
export async function leerCampanaDia(desde: string, hasta: string): Promise<DiaCampana[]> {
  const filas = await sql().query(
    `select to_char(fecha, 'YYYY-MM-DD') as fecha, canal, campana, inversion, impresiones, alcance, clics, leads, intenciones
       from panel.campana_dia where fecha between $1 and $2 order by fecha, canal, campana`,
    [desde, hasta],
  );
  return filas as DiaCampana[];
}

export type Ingesta = {
  id: number; fuente: string; desde: string; hasta: string; filas: number;
  estado: "ok" | "error"; error: string | null; inicio: string; fin: string | null;
};

export async function ultimasIngestas(n = 12): Promise<Ingesta[]> {
  const filas = await sql().query(
    `select id, fuente, to_char(desde, 'YYYY-MM-DD') as desde, to_char(hasta, 'YYYY-MM-DD') as hasta,
            filas, estado, error, inicio::text, fin::text
       from panel.ingesta order by inicio desc limit $1`,
    [n],
  );
  return filas as Ingesta[];
}

/** Hasta qué día hay datos guardados de cada canal. */
export async function ultimoDiaGuardado(): Promise<Record<string, string | null>> {
  const filas = (await sql().query(
    `select canal, to_char(max(fecha), 'YYYY-MM-DD') as fecha from panel.campana_dia group by canal`,
  )) as Array<{ canal: string; fecha: string }>;
  return Object.fromEntries(filas.map((f) => [f.canal, f.fecha]));
}
