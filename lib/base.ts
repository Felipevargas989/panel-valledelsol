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

// ── Lecturas para las vistas (mismas formas que la v1) ───────
// Las páginas reciben exactamente los mismos objetos que antes recibían de
// las APIs, así que el cambio de fuente no las obliga a cambiar.
import { EVENTOS, HEREDADOS, type DatosSitio, type Totales } from "./ga4";
import type { PublicoMeta } from "./meta";
import { periodoAnterior, sumarDias } from "./calculos";

/** Consulta tipada: Neon devuelve filas genéricas y acá se les pone nombre. */
async function consulta<T>(texto: string, valores: unknown[] = []): Promise<T[]> {
  return (await sql().query(texto, valores)) as T[];
}

/** Cuándo fue la última corrida que incluyó el día de hoy (para el freno del botón). */
export async function ultimaIngestaDeHoy(hoy: string): Promise<string | null> {
  const filas = (await sql().query(
    `select max(inicio)::text as inicio from panel.ingesta where hasta = $1`,
    [hoy],
  )) as Array<{ inicio: string | null }>;
  return filas[0]?.inicio ?? null;
}

const sinDato = (v: string) => (!v || v === "(not set)" ? "Sin dato" : v);

async function totalesSitio(desde: string, hasta: string): Promise<Totales> {
  const f = (await sql().query(
    `select coalesce(sum(personas),0)::int personas, coalesce(sum(nuevos),0)::int nuevos,
            coalesce(sum(sesiones),0)::int sesiones, coalesce(sum(interactivas),0)::int interactivas,
            coalesce(sum(conversiones),0)::int conversiones,
            case when sum(sesiones) > 0 then sum(duracion_media * sesiones) / sum(sesiones) else 0 end as duracion
       from panel.sitio_dia where fecha between $1 and $2`,
    [desde, hasta],
  )) as Array<Record<string, number>>;
  const t = f[0] ?? {};
  return {
    personas: t.personas ?? 0, nuevos: t.nuevos ?? 0, sesiones: t.sesiones ?? 0,
    interactivas: t.interactivas ?? 0, conversiones: t.conversiones ?? 0, duracionMedia: Number(t.duracion ?? 0),
  };
}

/** Un desglose sumado en el rango, ordenado de mayor a menor. */
async function desgloseSitio(desde: string, hasta: string, tipo: string, limite: number) {
  return (await sql().query(
    `select clave, sum(sesiones)::int sesiones, sum(personas)::int personas, sum(conversiones)::int conversiones
       from panel.sitio_desglose where fecha between $1 and $2 and tipo = $3
      group by clave order by 2 desc, 3 desc limit $4`,
    [desde, hasta, tipo, limite],
  )) as Array<{ clave: string; sesiones: number; personas: number; conversiones: number }>;
}

/** El sitio en un rango, leído de la base: la misma forma que entregaba Analytics. */
export async function sitioDesdeBase(desde: string, hasta: string): Promise<DatosSitio> {
  const previo = periodoAnterior(desde, hasta);
  const [actual, anterior, dias, canales, fuentes, entradas, paginas, ciudades, aparatos, sistemas, eventos] =
    await Promise.all([
      totalesSitio(desde, hasta),
      totalesSitio(previo.desde, previo.hasta),
      consulta<{ fecha: string; sesiones: number; conversiones: number; personas: number }>(
        `select to_char(fecha,'YYYY-MM-DD') fecha, sesiones, conversiones, personas
           from panel.sitio_dia where fecha between $1 and $2 order by fecha`, [desde, hasta],
      ),
      desgloseSitio(desde, hasta, "canal", 12),
      desgloseSitio(desde, hasta, "fuente", 10),
      desgloseSitio(desde, hasta, "entrada", 10),
      consulta<{ clave: string; vistas: number }>(
        `select clave, sum(sesiones)::int vistas from panel.sitio_desglose
          where fecha between $1 and $2 and tipo = 'pagina' group by clave order by 2 desc limit 10`, [desde, hasta],
      ),
      desgloseSitio(desde, hasta, "ciudad", 10),
      desgloseSitio(desde, hasta, "aparato", 5),
      desgloseSitio(desde, hasta, "sistema", 7),
      consulta<{ clave: string; cantidad: number }>(
        `select clave, sum(conversiones)::int cantidad from panel.sitio_desglose
          where fecha between $1 and $2 and tipo = 'evento' group by clave order by 2 desc`, [desde, hasta],
      ),
    ]);

  // Los días sin fila (sin visitas o sin ingesta) se rellenan con cero.
  const porDia = new Map(dias.map((d) => [d.fecha, d]));
  const serie: DatosSitio["dias"] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const x = porDia.get(d);
    serie.push({ fecha: d, sesiones: x?.sesiones ?? 0, conversiones: x?.conversiones ?? 0, personas: x?.personas ?? 0 });
  }

  const porPersonas = (xs: Array<{ clave: string; personas: number }>): Array<[string, number]> =>
    xs.map((x): [string, number] => [sinDato(x.clave), x.personas]).sort((a, b) => b[1] - a[1]);

  return {
    desde, hasta, actual, anterior, dias: serie,
    canales: canales.map((c) => ({ nombre: c.clave, sesiones: c.sesiones, conversiones: c.conversiones })),
    fuentes: fuentes.map((c) => ({ nombre: sinDato(c.clave), sesiones: c.sesiones, conversiones: c.conversiones })),
    eventos: eventos.map((e) => ({
      clave: e.clave, nombre: EVENTOS[e.clave] ?? HEREDADOS[e.clave] ?? e.clave,
      cantidad: e.cantidad, nuestra: e.clave in EVENTOS,
    })),
    conversionesAnalytics: eventos.reduce((t, e) => t + e.cantidad, 0),
    entradas: entradas.map((e) => ({
      pagina: e.clave === "/" ? "Portada ( / )" : sinDato(e.clave), sesiones: e.sesiones, conversiones: e.conversiones,
    })),
    paginas: paginas.map((p): [string, number] => [sinDato(p.clave), p.vistas]),
    ciudades: porPersonas(ciudades),
    dispositivos: porPersonas(aparatos),
    sistemas: porPersonas(sistemas),
  };
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const enTuZona = (region: string) => /bio ?bio|nuble/.test(sinTildes(region));

/** La radiografía de Meta en un rango, leída de la base. */
export async function publicoMetaDesdeBase(desde: string, hasta: string): Promise<PublicoMeta> {
  const filas = (await sql().query(
    `select tipo, clave, sum(gasto)::int gasto, sum(conversaciones)::int conversaciones, sum(contactos)::int contactos
       from panel.meta_desglose where fecha between $1 and $2 group by tipo, clave`,
    [desde, hasta],
  )) as Array<{ tipo: string; clave: string; gasto: number; conversaciones: number; contactos: number }>;

  const de = (tipo: string) => filas.filter((f) => f.tipo === tipo);
  const conCosto = (tipo: string): Array<[string, number, number]> =>
    de(tipo)
      .filter((f) => f.conversaciones > 0)
      .map((f) => [f.clave, f.conversaciones, Math.round(f.gasto / f.conversaciones)]);
  const porConv = (a: [string, number, number], b: [string, number, number]) => b[1] - a[1];

  return {
    edad: conCosto("edad").sort((a, b) => a[0].localeCompare(b[0])),
    genero: conCosto("genero").sort(porConv),
    plataforma: conCosto("plataforma").sort(porConv),
    ubicaciones: conCosto("ubicacion").sort(porConv).slice(0, 6),
    regiones: de("region")
      .filter((f) => f.gasto >= 1)
      .map((f): [string, number, number, boolean] => [f.clave, f.gasto, f.contactos, enTuZona(f.clave)])
      .sort((a, b) => b[1] - a[1]),
  };
}

/** Totales por día de las campañas (Meta + Google), para el mes a mes. */
export async function serieCampanasDesdeBase(desde: string, hasta: string) {
  return (await sql().query(
    `select to_char(fecha,'YYYY-MM-DD') fecha, sum(inversion)::int inversion, sum(impresiones)::int impresiones, sum(clics)::int clics
       from panel.campana_dia where fecha between $1 and $2 group by fecha order by fecha`,
    [desde, hasta],
  )) as Array<{ fecha: string; inversion: number; impresiones: number; clics: number }>;
}

/** Visitas por día, para la línea «hace un año» y el mes a mes del sitio. */
export async function visitasDesdeBase(desde: string, hasta: string): Promise<Array<{ fecha: string; valor: number }>> {
  const filas = await consulta<{ fecha: string; valor: number }>(
    `select to_char(fecha,'YYYY-MM-DD') fecha, sesiones valor from panel.sitio_dia where fecha between $1 and $2`,
    [desde, hasta],
  );
  const porDia = new Map(filas.map((f) => [f.fecha, f.valor]));
  const serie: Array<{ fecha: string; valor: number }> = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) serie.push({ fecha: d, valor: porDia.get(d) ?? 0 });
  return serie;
}

/** Primer día con datos en la base (para el filtro de fechas). */
export const INICIO_BASE = "2025-01-01";
