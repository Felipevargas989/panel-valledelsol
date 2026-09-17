// CONEXIÓN CON META (Facebook e Instagram)
//
// Lee la cuenta publicitaria "Valle del Sol Quillón" con un usuario del
// sistema que solo tiene permiso de "Ver rendimiento" (ads_read). La llave
// vive en la variable META_TOKEN de Vercel y viaja en la cabecera, nunca en
// la dirección, para que no quede escrita en ningún registro.
//
// Medido el 16-09-2026 contra la carga manual: "2026-05 Cabañas" entre el 1 y
// el 14 de septiembre da $41.115 y 84 conversaciones, exacto. Por región Meta
// no entrega conversaciones iniciadas, solo "contactos de mensajes": por eso
// esa tarjeta usa contactos.

import { unstable_cache } from "next/cache";
import { hoyEnChile, sumarDias } from "./calculos";
import type { DiaCampana } from "./datos";

const VERSION = "v23.0";
const CUENTA = "act_754332959617394";
const CONVERSACION = "onsite_conversion.messaging_conversation_started_7d";
const CONTACTO = "onsite_conversion.total_messaging_connection";

export const metaConectado = () => Boolean(process.env.META_TOKEN?.trim());

// Cada respuesta de Meta se guarda un día entero: decisión de Felipe el
// 17-09-2026, después de que Meta bloqueara la llave («API access blocked»)
// por exceso de consultas de una app nueva. Una consulta al día y basta.
const UN_DIA = 86400;

// Y si Meta responde con un error, no se le vuelve a preguntar por media
// hora: cada visita a la página reintentando es justo lo que alarga el
// bloqueo. El reloj vive en la memoria del servidor, así que se olvida solo.
const ESPERA_TRAS_FALLA = 30 * 60 * 1000;
let calladoHasta = 0;
let ultimaFalla: ErrorMeta | null = null;

// ── Errores que se pueden explicar ───────────────────────────
export class ErrorMeta extends Error {
  constructor(public tipo: "llave" | "permiso" | "espera" | "otro", mensaje: string) {
    super(mensaje);
  }
}

export function explicarErrorMeta(e: unknown): string {
  if (e instanceof ErrorMeta) {
    if (e.tipo === "llave")
      return "Meta rechazó la llave: puede haber sido revocada o quedó mal pegada en Vercel (variable META_TOKEN).";
    if (e.tipo === "permiso")
      return "La llave funciona, pero el usuario del sistema «panel» perdió el permiso de Ver rendimiento sobre la cuenta publicitaria.";
    if (e.tipo === "espera")
      return "Meta bloqueó las consultas por exceso de llamadas: el cupo de una app nueva es bajo. Se desbloquea solo, normalmente en horas; el panel reintenta cada media hora y ahora pregunta una sola vez al día.";
    return `Meta respondió con un error: ${e.message}`;
  }
  return "No se pudo conectar con Meta. Suele ser pasajero: recarga en un minuto.";
}

// ── Llamadas ─────────────────────────────────────────────────
type Accion = { action_type: string; value: string };
type Fila = {
  [campo: string]: string | Accion[] | undefined;
  actions?: Accion[];
};

async function insights(params: Record<string, string>): Promise<Fila[]> {
  const token = process.env.META_TOKEN?.trim();
  if (!token) throw new ErrorMeta("llave", "no hay llave");
  if (ultimaFalla && Date.now() < calladoHasta) throw ultimaFalla;

  const url = new URL(`https://graph.facebook.com/${VERSION}/${CUENTA}/insights`);
  for (const [k, v] of Object.entries({ ...params, limit: "500" })) url.searchParams.set(k, v);

  const filas: Fila[] = [];
  let siguiente: string | null = url.toString();
  // Tope de páginas por si algo se descontrola: 20 × 500 filas sobra.
  for (let vuelta = 0; siguiente && vuelta < 20; vuelta++) {
    const r: Response = await fetch(siguiente, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const c = j.error?.code;
      const mensaje: string = j.error?.message ?? `HTTP ${r.status}`;
      // Ojo con el orden: el bloqueo por cupo llega con código 200, el mismo
      // que un problema de permisos. Lo distingue el texto, no el número.
      const tipo =
        /access blocked/i.test(mensaje) ? "espera"
        : c === 190 ? "llave"
        : c === 200 || c === 10 || c === 272 ? "permiso"
        : [4, 17, 32, 613, 80000, 80004].includes(c) ? "espera"
        : "otro";
      const falla = new ErrorMeta(tipo, mensaje);
      ultimaFalla = falla;
      calladoHasta = Date.now() + ESPERA_TRAS_FALLA;
      throw falla;
    }
    ultimaFalla = null;
    filas.push(...(j.data ?? []));
    siguiente = j.paging?.next ?? null;
  }
  return filas;
}

const texto = (f: Fila, campo: string) => (typeof f[campo] === "string" ? (f[campo] as string) : "");
const cifra = (f: Fila, campo: string) => Number(texto(f, campo)) || 0;
const accion = (f: Fila, tipo: string) =>
  Number(f.actions?.find((a) => a.action_type === tipo)?.value ?? 0) || 0;
const rango = (desde: string, hasta: string) => JSON.stringify({ since: desde, until: hasta });

// ── Por día y campaña (vista Dinero) ─────────────────────────
// Clics = clics al enlace (el botón para escribir), no todos los clics:
// así se pueden comparar con los clics de Google.
async function consultarDias(desde: string, hasta: string): Promise<DiaCampana[]> {
  const filas = await insights({
    level: "campaign",
    time_increment: "1",
    time_range: rango(desde, hasta),
    fields: "campaign_name,spend,impressions,reach,inline_link_clicks,actions",
  });
  return filas.map((f) => ({
    fecha: texto(f, "date_start"),
    canal: "meta" as const,
    campana: texto(f, "campaign_name"),
    inversion: Math.round(cifra(f, "spend")),
    impresiones: cifra(f, "impressions"),
    alcance: cifra(f, "reach"),
    clics: cifra(f, "inline_link_clicks"),
    leads: accion(f, CONVERSACION),
  }));
}

export const metaDias = unstable_cache(consultarDias, ["meta-dias-v2"], { revalidate: UN_DIA });

// ── Radiografía del público (vista Público) ──────────────────
export type PublicoMeta = {
  edad: Array<[string, number, number]>;        // [grupo, conversaciones, costo de cada una]
  genero: Array<[string, number, number]>;
  plataforma: Array<[string, number, number]>;
  ubicaciones: Array<[string, number, number]>;
  regiones: Array<[string, number, number, boolean]>; // [región, gasto, contactos, en tu zona]
};

const GENERO: Record<string, string> = { female: "Mujeres", male: "Hombres", unknown: "Sin dato" };

const PLATAFORMA: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  threads: "Threads",
};

const UBICACION: Record<string, string> = {
  "facebook|feed": "Feed de Facebook",
  "instagram|feed": "Feed de Instagram",
  "facebook|facebook_reels": "Reels de Facebook",
  "instagram|instagram_reels": "Reels de Instagram",
  "facebook|facebook_stories": "Historias de Facebook",
  "instagram|instagram_stories": "Historias de Instagram",
  "instagram|instagram_explore": "Explorar de Instagram",
  "facebook|search": "Búsqueda de Facebook",
  "facebook|marketplace": "Marketplace",
  "facebook|instream_video": "Video in-stream",
  "facebook|facebook_reels_overlay": "Anuncios sobre Reels",
  "facebook|facebook_notification": "Notificaciones de Facebook",
  "facebook|facebook_profile_feed": "Feed de perfiles",
  "whatsapp|status": "Estados de WhatsApp",
  "audience_network|an_classic": "Audience Network",
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tu zona es Bío Bío y Ñuble, donde están Chillán, Concepción y Los Ángeles. */
const enTuZona = (region: string) => /bio ?bio|nuble/.test(sinTildes(region));

const conCosto = (nombre: string, f: Fila): [string, number, number] => {
  const conv = accion(f, CONVERSACION);
  return [nombre, conv, conv > 0 ? Math.round(cifra(f, "spend") / conv) : NaN];
};

async function consultarPublico(desde: string, hasta: string): Promise<PublicoMeta> {
  const base = { time_range: rango(desde, hasta), fields: "spend,actions" };
  const [edad, genero, plataforma, ubicacion, region] = await Promise.all([
    insights({ ...base, breakdowns: "age" }),
    insights({ ...base, breakdowns: "gender" }),
    insights({ ...base, breakdowns: "publisher_platform" }),
    insights({ ...base, breakdowns: "publisher_platform,platform_position" }),
    insights({ ...base, breakdowns: "region" }),
  ]);

  const porConversaciones = (a: [string, number, number], b: [string, number, number]) => b[1] - a[1];

  return {
    edad: edad
      .map((f) => conCosto(texto(f, "age").replace("-", "–"), f))
      .filter((e) => e[1] > 0)
      .sort((a, b) => a[0].localeCompare(b[0])),
    genero: genero
      .map((f) => conCosto(GENERO[texto(f, "gender")] ?? texto(f, "gender"), f))
      .filter((g) => g[1] > 0)
      .sort(porConversaciones),
    plataforma: plataforma
      .map((f) => conCosto(PLATAFORMA[texto(f, "publisher_platform")] ?? texto(f, "publisher_platform"), f))
      .filter((p) => p[1] > 0)
      .sort(porConversaciones),
    ubicaciones: ubicacion
      .map((f) => {
        const clave = `${texto(f, "publisher_platform")}|${texto(f, "platform_position")}`;
        return conCosto(UBICACION[clave] ?? texto(f, "platform_position"), f);
      })
      .filter((u) => u[1] > 0)
      .sort(porConversaciones)
      .slice(0, 6),
    regiones: region
      .map((f): [string, number, number, boolean] => {
        const limpio = texto(f, "region")
          .replace(/ Metropolitan Region$/, "")
          .replace(/ Region$/, "");
        // Meta usa el mapa antiguo de regiones: Ñuble viene dentro de Bío Bío.
        const nombre = /^b[ií]o ?b[ií]o$/i.test(limpio) ? "Bío Bío y Ñuble" : limpio;
        return [nombre, Math.round(cifra(f, "spend")), accion(f, CONTACTO), enTuZona(nombre)];
      })
      .filter((r) => r[1] >= 1)
      .sort((a, b) => b[1] - a[1]),
  };
}

export const metaPublico = unstable_cache(consultarPublico, ["meta-publico-v2"], { revalidate: UN_DIA });

// ── Totales por día, sin desglose (comparación anual) ────────
// Para el mes a mes no hace falta saber la campaña: pedir campaña por día
// durante año y medio son unas 1.800 filas en cuatro páginas, y eso fue lo
// que falló en Vercel el 17-09 (el gráfico quedó mostrando solo Google).
// Sin desglose son 600 filas: una llamada, a veces dos.
export type DiaMeta = { fecha: string; inversion: number; impresiones: number; clics: number };

async function consultarTotales(desde: string, hasta: string): Promise<DiaMeta[]> {
  const filas = await insights({
    time_increment: "1",
    time_range: rango(desde, hasta),
    fields: "spend,impressions,inline_link_clicks",
  });
  return filas.map((f) => ({
    fecha: texto(f, "date_start"),
    inversion: Math.round(cifra(f, "spend")),
    impresiones: cifra(f, "impressions"),
    clics: cifra(f, "inline_link_clicks"),
  }));
}

export const metaTotalesDia = unstable_cache(consultarTotales, ["meta-totales-v2"], { revalidate: UN_DIA });

/** ¿Meta está contestando ahora? Tener la llave no basta: el 17-09-2026 el
 *  panel decía «Meta en vivo» con la API bloqueada. Se le pide un solo día,
 *  que además ya viene guardado, así que no gasta consultas de más. */
export async function metaResponde() {
  if (!metaConectado()) return false;
  try {
    const ayer = sumarDias(hoyEnChile(), -1);
    await metaTotalesDia(ayer, ayer);
    return true;
  } catch {
    return false;
  }
}
