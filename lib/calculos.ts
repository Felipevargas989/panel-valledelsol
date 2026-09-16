import { DIAS, SUPUESTOS, type Canal, type DiaCampana } from "./datos";

// ── Formato chileno ──────────────────────────────────────────
const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const NUM = new Intl.NumberFormat("es-CL");

export const plata = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v) ? "—" : CLP.format(Math.round(v));

export const numero = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v) ? "—" : NUM.format(Math.round(v));

export const porcentaje = (v: number | null | undefined, dec = 2) =>
  v === null || v === undefined || !isFinite(v)
    ? "—"
    : (v * 100).toFixed(dec).replace(".", ",") + " %";

export const veces = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v)
    ? "—"
    : v.toFixed(1).replace(".", ",") + "x";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-09-14" → "14 sep". Parte la fecha a mano para no depender de la
 *  zona horaria del navegador, que corre los días un lugar. */
export function fechaCorta(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

export function fechaLarga(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} ${a}`;
}

/** Suma días a una fecha ISO sin tocar zonas horarias. */
export function sumarDias(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(a, m - 1, d) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 67 → "1 min 07 s". */
export function duracionTexto(segundos: number) {
  if (!isFinite(segundos) || segundos <= 0) return "—";
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

/** La fecha de hoy en Chile, AAAA-MM-DD. El servidor de Vercel vive en otra
 *  zona horaria y, sin esto, "hoy" cambia a las nueve de la noche. */
export function hoyEnChile() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function diasEntre(desde: string, hasta: string) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
}

// ── Métricas ─────────────────────────────────────────────────
export type Resumen = {
  inversion: number;
  impresiones: number;
  alcance: number;
  clics: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion: number;
  cpl: number;
  cierres: number;
  ingreso: number;
  roas: number;
  roi: number;
  cac: number;
  comisionOta: number;
};

/** Una campaña con «cabañas» en el nombre vale según los supuestos de
 *  cabañas; el resto, según los de eventos. Sumarlas con un solo supuesto
 *  infla el retorno de forma absurda. */
function supuestoDe(campana: string) {
  return /caba/i.test(campana) ? SUPUESTOS.cabanas : SUPUESTOS.eventos;
}

export function resumir(filas: DiaCampana[]): Resumen {
  let inversion = 0, impresiones = 0, alcance = 0, clics = 0, leads = 0;
  let cierres = 0, ingreso = 0;

  for (const f of filas) {
    inversion += f.inversion;
    impresiones += f.impresiones;
    alcance += f.alcance ?? 0;
    clics += f.clics;
    const l = f.leads ?? 0;
    leads += l;
    const s = supuestoDe(f.campana);
    const c = l * s.cierre;
    cierres += c;
    ingreso += c * s.ticket;
  }

  const ticketMedio = cierres > 0 ? ingreso / cierres : SUPUESTOS.eventos.ticket;

  return {
    inversion, impresiones, alcance, clics, leads,
    ctr: impresiones > 0 ? clics / impresiones : NaN,
    cpc: clics > 0 ? inversion / clics : NaN,
    cpm: impresiones > 0 ? (inversion / impresiones) * 1000 : NaN,
    conversion: clics > 0 ? leads / clics : NaN,
    cpl: leads > 0 ? inversion / leads : NaN,
    cierres,
    ingreso,
    roas: inversion > 0 ? ingreso / inversion : NaN,
    roi: inversion > 0 ? (ingreso - inversion) / inversion : NaN,
    cac: cierres > 0 ? inversion / cierres : NaN,
    comisionOta: ticketMedio * SUPUESTOS.comisionOta,
  };
}

// ── Filtro por fechas ────────────────────────────────────────
export function enRango(desde: string, hasta: string) {
  return DIAS.filter((d) => d.fecha >= desde && d.fecha <= hasta);
}

/** El período anterior del mismo largo, para poder comparar. */
export function periodoAnterior(desde: string, hasta: string) {
  const largo = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -largo), hasta: sumarDias(desde, -1) };
}

export type Variacion = { valor: number; bueno: boolean; neutro?: boolean } | null;

/** `menosEsMejor` invierte el juicio: en costos, bajar es buena noticia. */
export function variacion(
  actual: number,
  anterior: number,
  menosEsMejor = false
): Variacion {
  if (!isFinite(actual) || !isFinite(anterior) || anterior === 0) return null;
  const r = (actual - anterior) / anterior;
  if (Math.abs(r) < 0.005) return { valor: 0, bueno: true };
  return { valor: r, bueno: menosEsMejor ? r < 0 : r > 0 };
}

/** Para lo que no es ni bueno ni malo por sí solo, como la inversión:
 *  gastar más puede ser una buena decisión o un problema. Se muestra el
 *  cambio sin pintarlo de verde ni de rojo. */
export function variacionNeutra(actual: number, anterior: number): Variacion {
  const v = variacion(actual, anterior);
  return v ? { ...v, neutro: true } : null;
}

// ── Series por día, rellenando los días sin datos ────────────
export type PuntoDia = { fecha: string; meta: number; google: number; total: number };

export function serieDiaria(
  filas: DiaCampana[],
  desde: string,
  hasta: string,
  campo: "inversion" | "impresiones" | "clics" | "leads"
): PuntoDia[] {
  const mapa = new Map<string, { meta: number; google: number }>();
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    mapa.set(f, { meta: 0, google: 0 });
  }
  for (const f of filas) {
    const p = mapa.get(f.fecha);
    if (!p) continue;
    const v = campo === "leads" ? f.leads ?? 0 : f[campo];
    p[f.canal] += v;
  }
  return [...mapa.entries()].map(([fecha, v]) => ({
    fecha,
    meta: v.meta,
    google: v.google,
    total: v.meta + v.google,
  }));
}

export function porCampana(filas: DiaCampana[]) {
  const mapa = new Map<string, { canal: Canal; filas: DiaCampana[] }>();
  for (const f of filas) {
    if (!mapa.has(f.campana)) mapa.set(f.campana, { canal: f.canal, filas: [] });
    mapa.get(f.campana)!.filas.push(f);
  }
  return [...mapa.entries()]
    .map(([campana, v]) => ({ campana, canal: v.canal, ...resumir(v.filas) }))
    .sort((a, b) => b.inversion - a.inversion);
}

export function porCanal(filas: DiaCampana[]) {
  const canales: Canal[] = ["google", "meta"];
  return canales
    .map((canal) => ({ canal, ...resumir(filas.filter((f) => f.canal === canal)) }))
    .filter((c) => c.inversion > 0);
}

export const NOMBRE_CANAL: Record<Canal, string> = {
  google: "Google Ads",
  meta: "Meta",
};
