// CONEXIÓN CON GOOGLE ANALYTICS (GA4)
//
// Lee la propiedad "Valle del Sol" con una cuenta de servicio de solo
// lectura. La llave vive en la variable GA4_CREDENCIALES de Vercel (el JSON
// tal cual, o en base64 para el entorno local). Nunca se escribe en el
// código: este repositorio es público.
//
// No usa la librería oficial de Google a propósito: esa arrastra gRPC y pesa
// decenas de megas. Acá bastan dos llamadas HTTP — pedir un pase firmado con
// la llave y consultar los informes.
//
// Todo lo que se consulta queda guardado un rato para no gastar cuota:
// los informes una hora, el tiempo real 55 segundos.

import { createSign } from "node:crypto";
import { unstable_cache } from "next/cache";
import { sumarDias, periodoAnterior } from "./calculos";
import type { DiaCampana } from "./datos";

export const PROPIEDAD_GA4 = "353296129";

// ── Credenciales ─────────────────────────────────────────────
type Credenciales = { client_email: string; private_key: string };

function leer(texto: string): Credenciales | null {
  try {
    const j = JSON.parse(texto);
    return j?.client_email && j?.private_key
      ? { client_email: j.client_email, private_key: j.private_key }
      : null;
  } catch {
    return null;
  }
}

function credenciales(): Credenciales | null {
  const crudo = process.env.GA4_CREDENCIALES?.trim();
  if (!crudo) return null;
  return leer(crudo) ?? leer(Buffer.from(crudo, "base64").toString("utf8"));
}

export const ga4Conectado = () => credenciales() !== null;

// ── Errores que se pueden explicar ───────────────────────────
export class ErrorGa4 extends Error {
  constructor(public tipo: "llave" | "permiso" | "otro", mensaje: string) {
    super(mensaje);
  }
}

/** Traduce el error a algo que Felipe pueda resolver sin leer código. */
export function explicarError(e: unknown): string {
  if (e instanceof ErrorGa4) {
    if (e.tipo === "llave")
      return "Google rechazó la llave. Revisa que en Vercel esté pegado el contenido completo del archivo JSON, sin recortes.";
    if (e.tipo === "permiso")
      return "La llave funciona, pero todavía no tiene permiso para leer la propiedad Valle del Sol. Falta agregar el correo de la cuenta de servicio como Lector en Analytics (Administrador → Gestión de accesos a la propiedad).";
    return `Analytics respondió con un error: ${e.message}`;
  }
  return "No se pudo conectar con Analytics. Suele ser pasajero: recarga en un minuto.";
}

// ── Pase de acceso ───────────────────────────────────────────
let pase: { valor: string; vence: number } | null = null;
const b64url = (s: string) => Buffer.from(s).toString("base64url");

async function paseDeAcceso(c: Credenciales): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (pase && pase.vence - 60 > ahora) return pase.valor;

  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(
    JSON.stringify({
      iss: c.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    })
  );

  let firma: string;
  try {
    firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(c.private_key, "base64url");
  } catch {
    throw new ErrorGa4("llave", "la llave privada no se pudo leer");
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecera}.${cuerpo}.${firma}`,
    }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new ErrorGa4("llave", j.error_description || j.error || `HTTP ${r.status}`);
  }
  pase = { valor: j.access_token, vence: ahora + (j.expires_in ?? 3600) };
  return pase.valor;
}

// ── Llamadas a la API ────────────────────────────────────────
type Reporte = {
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
  totals?: Array<{ metricValues?: Array<{ value: string }> }>;
};

async function llamar<T>(metodo: string, cuerpo: unknown): Promise<T> {
  const c = credenciales();
  if (!c) throw new ErrorGa4("llave", "no hay credenciales");
  const token = await paseDeAcceso(c);
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPIEDAD_GA4}:${metodo}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    }
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const mensaje = j?.error?.message ?? `HTTP ${r.status}`;
    throw new ErrorGa4(r.status === 403 ? "permiso" : r.status === 401 ? "llave" : "otro", mensaje);
  }
  return j as T;
}

type Fila = { d: string[]; m: number[] };

const filas = (r: Reporte | undefined): Fila[] =>
  (r?.rows ?? []).map((row) => ({
    d: (row.dimensionValues ?? []).map((x) => x.value),
    m: (row.metricValues ?? []).map((x) => Number(x.value) || 0),
  }));

// ── Traducciones ─────────────────────────────────────────────
const CANALES: Record<string, string> = {
  Direct: "Directo",
  "Organic Search": "Búsqueda orgánica",
  "Organic Social": "Redes sociales",
  "Paid Social": "Redes pagadas",
  "Paid Search": "Búsqueda pagada",
  Referral: "Referencias",
  Email: "Correo",
  Unassigned: "Sin asignar",
  "AI Assistant": "Asistentes de IA",
  "Cross-network": "Varias redes (Google)",
  Display: "Display",
  "Organic Video": "Video orgánico",
  "Paid Video": "Video pagado",
  "Paid Other": "Otro pagado",
  "Organic Shopping": "Shopping orgánico",
  "Paid Shopping": "Shopping pagado",
  SMS: "SMS",
  Affiliates: "Afiliados",
};

const DISPOSITIVOS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  "smart tv": "Televisor",
};

// GA escribe las ciudades sin tildes; se las devolvemos a las conocidas.
const CIUDADES: Record<string, string> = {
  Concepcion: "Concepción",
  Chillan: "Chillán",
  Hualpen: "Hualpén",
  "Los Angeles": "Los Ángeles",
  Tome: "Tomé",
  Quillon: "Quillón",
  Bulnes: "Bulnes",
  Valparaiso: "Valparaíso",
  Vina: "Viña del Mar",
  "Vina del Mar": "Viña del Mar",
  Rancagua: "Rancagua",
  Curico: "Curicó",
  Nuble: "Ñuble",
};

/** Las conversiones que configuramos nosotros en Tag Manager (14-09-2026).
 *  Son las ÚNICAS que el panel cuenta como conversión. */
export const EVENTOS: Record<string, string> = {
  eventos_cotizacion_enviada: "Cotización de evento enviada",
  eventos_cotizar: "Apretó «Cotizar» en eventos",
  eventos_whatsapp: "WhatsApp desde eventos",
  cabanas_reservar: "Apretó «Reservar» en cabañas",
  cabanas_reserva_pagada: "Reserva de cabaña pagada",
  cabanas_whatsapp: "WhatsApp desde cabañas",
  whatsapp_sin_linea: "WhatsApp sin línea de negocio",
};

// Analytics también marca como «evento clave» cosas heredadas del sitio
// viejo que NO son conversiones: son simples visitas a una página. Medido el
// 16-09-2026: en 28 días fueron 502 de las 582 «conversiones» que mostraba
// Analytics. Se muestran aparte, con su nombre real, y no se suman.
const HEREDADOS: Record<string, string> = {
  pagina_cabanas: "Vio la página de cabañas",
  paseos_curso: "Vio paseos de curso",
  matrimonios: "Vio matrimonios",
  eventos_corporativos: "Vio eventos corporativos",
  ads_conversion_Vista_de_p_gina_Carga_d_1: "Vista de página para Google Ads",
  form_submit: "Envío de formulario (automático)",
  purchase: "Compra (evento antiguo)",
};

const NUESTRAS = Object.keys(EVENTOS);
const soloNuestras = {
  filter: { fieldName: "eventName", inListFilter: { values: NUESTRAS } },
};

const sinDato = (v: string) => (!v || v === "(not set)" ? "Sin dato" : v);

// ── Informe del sitio ────────────────────────────────────────
export type Totales = {
  personas: number;
  nuevos: number;
  sesiones: number;
  interactivas: number;
  conversiones: number;
  duracionMedia: number; // segundos por visita
};

export type DatosSitio = {
  desde: string;
  hasta: string;
  actual: Totales;
  anterior: Totales;
  dias: Array<{ fecha: string; sesiones: number; conversiones: number; personas: number }>;
  canales: Array<{ nombre: string; sesiones: number; conversiones: number }>;
  fuentes: Array<{ nombre: string; sesiones: number; conversiones: number }>;
  /** Todo lo que Analytics marca como evento clave, nuestro o heredado. */
  eventos: Array<{ clave: string; nombre: string; cantidad: number; nuestra: boolean }>;
  /** Lo que Analytics suma como conversiones, heredadas incluidas. */
  conversionesAnalytics: number;
  entradas: Array<{ pagina: string; sesiones: number; conversiones: number }>;
  paginas: Array<[string, number]>;
  ciudades: Array<[string, number]>;
  dispositivos: Array<[string, number]>;
  sistemas: Array<[string, number]>;
};

const vacios = (): Totales => ({
  personas: 0, nuevos: 0, sesiones: 0, interactivas: 0, conversiones: 0, duracionMedia: 0,
});

async function consultarSitio(desde: string, hasta: string): Promise<DatosSitio> {
  const previo = periodoAnterior(desde, hasta);
  const rango = [{ startDate: desde, endDate: hasta }];
  const top = (dim: string, metricas: string[], limite: number, orden = metricas[0]) => ({
    dateRanges: rango,
    dimensions: [{ name: dim }],
    metrics: metricas.map((name) => ({ name })),
    orderBys: [{ metric: { metricName: orden }, desc: true }],
    limit: limite,
  });

  const convPor = (dim: string, limite: number) => ({
    dateRanges: rango,
    dimensions: [{ name: dim }],
    metrics: [{ name: "keyEvents" }],
    dimensionFilter: soloNuestras,
    limit: limite,
  });

  // GA4 acepta hasta cinco informes por llamada: van tres tandas en paralelo.
  // La tercera repite los cortes contando solo NUESTRAS conversiones.
  const [a, b, c] = await Promise.all([
    llamar<{ reports: Reporte[] }>("batchRunReports", {
      requests: [
        {
          dateRanges: [
            { startDate: desde, endDate: hasta, name: "actual" },
            { startDate: previo.desde, endDate: previo.hasta, name: "anterior" },
          ],
          metrics: ["activeUsers", "newUsers", "sessions", "engagedSessions", "keyEvents", "averageSessionDuration"]
            .map((name) => ({ name })),
        },
        {
          dateRanges: rango,
          dimensions: [{ name: "date" }],
          metrics: [{ name: "sessions" }, { name: "keyEvents" }, { name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: 400,
        },
        top("sessionDefaultChannelGroup", ["sessions", "keyEvents"], 12),
        top("sessionSourceMedium", ["sessions", "keyEvents"], 10),
        top("eventName", ["keyEvents"], 25),
      ],
    }),
    llamar<{ reports: Reporte[] }>("batchRunReports", {
      requests: [
        top("landingPage", ["sessions", "keyEvents"], 10),
        top("pageTitle", ["screenPageViews"], 10),
        top("city", ["activeUsers"], 10),
        top("deviceCategory", ["activeUsers"], 5),
        top("operatingSystem", ["activeUsers"], 7),
      ],
    }),
    llamar<{ reports: Reporte[] }>("batchRunReports", {
      requests: [
        {
          dateRanges: [
            { startDate: desde, endDate: hasta, name: "actual" },
            { startDate: previo.desde, endDate: previo.hasta, name: "anterior" },
          ],
          metrics: [{ name: "keyEvents" }],
          dimensionFilter: soloNuestras,
        },
        convPor("date", 400),
        convPor("sessionDefaultChannelGroup", 50),
        convPor("sessionSourceMedium", 200),
        convPor("landingPage", 200),
      ],
    }),
  ]);

  const [rTot, rDias, rCanales, rFuentes, rEventos] = a.reports ?? [];
  const [rEntradas, rPaginas, rCiudades, rDisp, rSo] = b.reports ?? [];
  const [cTot, cDias, cCanales, cFuentes, cEntradas] = c.reports ?? [];

  /** Conversiones nuestras por valor de la dimensión, para cruzar. */
  const indice = (r: Reporte | undefined) => new Map(filas(r).map((f) => [f.d[0], f.m[0]]));
  const convCanal = indice(cCanales);
  const convFuente = indice(cFuentes);
  const convEntrada = indice(cEntradas);
  const convDia = indice(cDias);

  // Con dos rangos de fecha, GA agrega sola la columna del rango.
  const totales = { actual: vacios(), anterior: vacios() };
  for (const f of filas(rTot)) {
    const cual = f.d[0] === "anterior" ? "anterior" : "actual";
    const [personas, nuevos, sesiones, interactivas, conversiones, duracionMedia] = f.m;
    totales[cual] = { personas, nuevos, sesiones, interactivas, conversiones, duracionMedia };
  }
  const conversionesAnalytics = totales.actual.conversiones;
  totales.actual.conversiones = 0;
  totales.anterior.conversiones = 0;
  for (const f of filas(cTot)) {
    totales[f.d[0] === "anterior" ? "anterior" : "actual"].conversiones = f.m[0];
  }

  // Los días sin visitas no vienen en la respuesta: se rellenan con cero.
  const porDia = new Map<string, number[]>(
    filas(rDias).map((f) => {
      const t = f.d[0]; // GA entrega la fecha como 20260914
      return [`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`, f.m];
    })
  );
  const dias: DatosSitio["dias"] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const m = porDia.get(d) ?? [0, 0, 0];
    const clave = d.replaceAll("-", "");
    dias.push({ fecha: d, sesiones: m[0], conversiones: convDia.get(clave) ?? 0, personas: m[2] });
  }

  const conSesiones = (
    r: Reporte | undefined,
    conv: Map<string, number>,
    traducir: (v: string) => string
  ) => filas(r).map((f) => ({ nombre: traducir(f.d[0]), sesiones: f.m[0], conversiones: conv.get(f.d[0]) ?? 0 }));

  return {
    desde,
    hasta,
    ...totales,
    dias,
    conversionesAnalytics,
    canales: conSesiones(rCanales, convCanal, (v) => CANALES[v] ?? v),
    fuentes: conSesiones(rFuentes, convFuente, sinDato),
    eventos: filas(rEventos)
      .filter((f) => f.m[0] > 0)
      .map((f) => ({
        clave: f.d[0],
        nombre: EVENTOS[f.d[0]] ?? HEREDADOS[f.d[0]] ?? f.d[0],
        cantidad: f.m[0],
        nuestra: f.d[0] in EVENTOS,
      })),
    entradas: filas(rEntradas).map((f) => ({
      pagina: f.d[0] === "/" ? "Portada ( / )" : sinDato(f.d[0]),
      sesiones: f.m[0],
      conversiones: convEntrada.get(f.d[0]) ?? 0,
    })),
    paginas: filas(rPaginas).map((f) => [sinDato(f.d[0]), f.m[0]]),
    ciudades: filas(rCiudades).map((f) => [CIUDADES[f.d[0]] ?? sinDato(f.d[0]), f.m[0]]),
    dispositivos: filas(rDisp).map((f) => [DISPOSITIVOS[f.d[0]] ?? sinDato(f.d[0]), f.m[0]]),
    sistemas: filas(rSo).map((f) => [f.d[0] === "iOS" ? "iPhone (iOS)" : f.d[0] === "Macintosh" ? "Mac" : sinDato(f.d[0]), f.m[0]]),
  };
}

export const datosSitio = unstable_cache(consultarSitio, ["ga4-sitio-v2"], { revalidate: 3600 });

// ── Tiempo real ──────────────────────────────────────────────
export type Ahora = {
  total: number;
  porMinuto: number[]; // 30 valores, del más antiguo al más reciente
  ciudades: Array<[string, number]>;
  pantallas: Array<[string, number]>;
  medidoEn: string;
};

async function consultarAhora(): Promise<Ahora> {
  const [rMin, rCiudad, rPantalla] = await Promise.all([
    llamar<Reporte>("runRealtimeReport", {
      dimensions: [{ name: "minutesAgo" }],
      metrics: [{ name: "activeUsers" }],
      limit: 30,
    }),
    llamar<Reporte>("runRealtimeReport", {
      dimensions: [{ name: "city" }],
      metrics: [{ name: "activeUsers" }],
      metricAggregations: ["TOTAL"],
      limit: 8,
    }),
    llamar<Reporte>("runRealtimeReport", {
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "activeUsers" }],
      limit: 6,
    }),
  ]);

  const porMinuto = new Array(30).fill(0);
  for (const f of filas(rMin)) {
    const hace = Number(f.d[0]);
    if (hace >= 0 && hace < 30) porMinuto[29 - hace] = f.m[0];
  }

  const ciudades = filas(rCiudad).map((f) => [CIUDADES[f.d[0]] ?? sinDato(f.d[0]), f.m[0]] as [string, number]);
  const total =
    Number(rCiudad.totals?.[0]?.metricValues?.[0]?.value) ||
    ciudades.reduce((s, c) => s + c[1], 0);

  return {
    total,
    porMinuto,
    ciudades,
    pantallas: filas(rPantalla).map((f) => [sinDato(f.d[0]), f.m[0]]),
    medidoEn: new Date().toISOString(),
  };
}

export const ahoraMismo = unstable_cache(consultarAhora, ["ga4-ahora-v1"], { revalidate: 55 });

// ── Google Ads, leído desde Analytics ───────────────────────
// Analytics está vinculado con la cuenta de Google Ads desde 2023 y trae
// gasto, clics e impresiones por campaña. Así Google Ads queda en vivo sin
// pedirle a Google un token de desarrollador (que tarda días).
//
// Qué cuenta como lead en Google, para que sea comparable con la
// conversación de WhatsApp que cuenta Meta: una cotización enviada, una
// reserva pagada o un WhatsApp. Los clics en «Cotizar» y «Reservar» van
// aparte como intención: muestran interés, pero la persona aún no escribió.
// Comprobado el 16-09-2026: el 14-09 calza exacto con lo que muestra Google
// Ads (Eventos $10.663 · 10 clics · 164 impresiones).

const LEADS_GOOGLE = [
  "eventos_cotizacion_enviada",
  "cabanas_reserva_pagada",
  "eventos_whatsapp",
  "cabanas_whatsapp",
  "whatsapp_sin_linea",
];
const INTENCIONES_GOOGLE = ["eventos_cotizar", "cabanas_reservar"];

async function consultarGoogleAds(desde: string, hasta: string): Promise<DiaCampana[]> {
  const rango = [{ startDate: desde, endDate: hasta }];
  const dims = [{ name: "date" }, { name: "sessionGoogleAdsCampaignName" }];
  const deGoogleAds = {
    notExpression: { filter: { fieldName: "sessionGoogleAdsCampaignName", stringFilter: { value: "(not set)" } } },
  };
  const eventos = (lista: string[]) => ({
    andGroup: {
      expressions: [{ filter: { fieldName: "eventName", inListFilter: { values: lista } } }, deGoogleAds],
    },
  });

  const r = await llamar<{ reports: Reporte[] }>("batchRunReports", {
    requests: [
      {
        dateRanges: rango,
        dimensions: dims,
        metrics: [{ name: "advertiserAdCost" }, { name: "advertiserAdClicks" }, { name: "advertiserAdImpressions" }],
        dimensionFilter: deGoogleAds,
        limit: 5000,
      },
      { dateRanges: rango, dimensions: dims, metrics: [{ name: "keyEvents" }], dimensionFilter: eventos(LEADS_GOOGLE), limit: 5000 },
      { dateRanges: rango, dimensions: dims, metrics: [{ name: "keyEvents" }], dimensionFilter: eventos(INTENCIONES_GOOGLE), limit: 5000 },
    ],
  });
  const [rCosto, rLeads, rIntencion] = r.reports ?? [];

  const mapa = new Map<string, DiaCampana>();
  const fecha = (t: string) => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  const fila = (f: Fila) => {
    const clave = `${f.d[0]}|${f.d[1]}`;
    let x = mapa.get(clave);
    if (!x) {
      x = {
        fecha: fecha(f.d[0]), canal: "google", campana: f.d[1],
        inversion: 0, impresiones: 0, alcance: null, clics: 0, leads: 0, intenciones: 0,
      };
      mapa.set(clave, x);
    }
    return x;
  };

  for (const f of filas(rCosto)) {
    const x = fila(f);
    x.inversion += f.m[0];
    x.clics += f.m[1];
    x.impresiones += f.m[2];
  }
  for (const f of filas(rLeads)) fila(f).leads = (fila(f).leads ?? 0) + f.m[0];
  for (const f of filas(rIntencion)) fila(f).intenciones = (fila(f).intenciones ?? 0) + f.m[0];

  return [...mapa.values()]
    .map((x) => ({ ...x, inversion: Math.round(x.inversion) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const googleAdsDias = unstable_cache(consultarGoogleAds, ["ga4-gads-v1"], { revalidate: 3600 });

// ── Visitas por día, para comparar contra el año anterior ────
// Solo sesiones: es liviano y sirve igual para la línea «hace un año» y para
// el mes a mes. Los días sin visitas se rellenan con cero.
async function consultarVisitas(desde: string, hasta: string): Promise<Array<{ fecha: string; valor: number }>> {
  const r = await llamar<Reporte>("runReport", {
    dateRanges: [{ startDate: desde, endDate: hasta }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    limit: 1000,
  });
  const porDia = new Map(filas(r).map((f) => [f.d[0], f.m[0]]));
  const serie: Array<{ fecha: string; valor: number }> = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    serie.push({ fecha: d, valor: porDia.get(d.replaceAll("-", "")) ?? 0 });
  }
  return serie;
}

export const visitasPorDia = unstable_cache(consultarVisitas, ["ga4-visitas-v1"], { revalidate: 3600 });
