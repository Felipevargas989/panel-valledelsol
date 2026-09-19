// DATOS DEL PANEL — medidos a mano el 15-09-2026
//
// Todo lo que hay acá salió de las plataformas, no de una estimación. Cada
// bloque dice de dónde viene y qué período cubre. Cuando conectemos las APIs
// este archivo se reemplaza por la consulta; la forma de los datos NO cambia,
// por eso las vistas y los gráficos siguen sirviendo igual.
//
// Comprobación hecha al cargarlos: la suma de los días de Meta calza exacto
// con los totales que muestra el Administrador de anuncios en cada tramo
// (16-24 ago $28.601/77 conv · 25-31 ago $21.167/59 · 1-5 sep $13.176/37 ·
// 1-14 sep $41.115/84 · 30 días $90.883/220).

export type Canal = "meta" | "google";

export type DiaCampana = {
  fecha: string;          // AAAA-MM-DD
  canal: Canal;
  campana: string;
  inversion: number;      // CLP
  impresiones: number;
  alcance: number | null; // Meta lo da; Google no
  clics: number;
  leads: number | null;   // null = el día aún no cierra
  /** Clics en «Cotizar» o «Reservar»: interés, todavía no contacto.
   *  Solo existe para Google (sale de Analytics). */
  intenciones?: number | null;
  /** Cotizaciones enviadas y reservas pagadas: lo más cerca de una venta que
   *  el panel puede medir hoy. Solo Google: las campañas de Meta llevan a
   *  WhatsApp y su cierre no se ve hasta conectar Eventia. */
  cotizaciones?: number | null;
};

// ───────────────────────────────────────────────────────────
// META · campaña "2026-05 Cabañas" · objetivo conversaciones
// Fuente: Administrador de anuncios, desglose por día.
// ───────────────────────────────────────────────────────────
const META: Array<[string, number, number, number, number, number | null]> = [
  // fecha, alcance, impresiones, clics, inversión, conversaciones
  ["2026-08-16", 1053, 1492, 72, 3876, 11],
  ["2026-08-17", 1003, 1451, 56, 3337, 5],
  ["2026-08-18", 653, 943, 50, 2528, 3],
  ["2026-08-19", 700, 1019, 49, 2933, 13],
  ["2026-08-20", 776, 1122, 45, 3086, 11],
  ["2026-08-21", 843, 1101, 33, 2395, 2],
  ["2026-08-22", 940, 1218, 38, 2827, 14],
  ["2026-08-23", 791, 1129, 40, 3837, 6],
  ["2026-08-24", 883, 1270, 53, 3782, 12],
  ["2026-08-25", 876, 1320, 51, 3386, 7],
  ["2026-08-26", 754, 1102, 50, 3254, 11],
  ["2026-08-27", 689, 982, 31, 2477, 3],
  ["2026-08-28", 575, 851, 33, 2314, 4],
  ["2026-08-29", 585, 816, 26, 1926, 8],
  ["2026-08-30", 1081, 1662, 59, 3914, 11],
  ["2026-08-31", 875, 1325, 64, 3896, 15],
  ["2026-09-01", 681, 960, 42, 2365, 4],
  ["2026-09-02", 983, 1408, 53, 2980, 15],
  ["2026-09-03", 749, 1019, 38, 2814, 6],
  ["2026-09-04", 788, 1101, 43, 2730, 7],
  ["2026-09-05", 800, 1096, 43, 2287, 5],
  ["2026-09-06", 969, 1353, 48, 4081, 7],
  ["2026-09-07", 945, 1397, 37, 3194, 3],
  ["2026-09-08", 603, 856, 36, 2840, 5],
  ["2026-09-09", 720, 1117, 59, 3494, 8],
  ["2026-09-10", 849, 1281, 58, 3379, 10],
  ["2026-09-11", 571, 794, 34, 2340, 3],
  ["2026-09-12", 600, 791, 17, 1644, 2],
  ["2026-09-13", 873, 1261, 43, 3846, 4],
  ["2026-09-14", 831, 1148, 46, 3121, 5],
  // El 15-09 no va: al medir estaba a medio día, con gasto contado pero sin
  // conversaciones cerradas, y eso inflaba el costo por lead un 81 %.
];

// ───────────────────────────────────────────────────────────
// GOOGLE ADS · las tres campañas partieron el 14-09-2026
// Fuente: Google Ads, cuenta 683-287-5597.
// ───────────────────────────────────────────────────────────
const GOOGLE: Array<[string, string, number, number, number, number]> = [
  // fecha, campaña, impresiones, clics, inversión, conversiones
  ["2026-09-14", "Eventos · Zona", 164, 10, 10663, 0],
  ["2026-09-14", "Cabañas · Parejas", 8, 1, 537, 1],
  ["2026-09-14", "Marca · Valle del Sol", 0, 0, 0, 0],
];

export const DIAS: DiaCampana[] = [
  ...META.map(([fecha, alcance, impresiones, clics, inversion, leads]) => ({
    fecha,
    canal: "meta" as const,
    campana: "Cabañas · Meta",
    inversion,
    impresiones,
    alcance,
    clics,
    leads,
  })),
  ...GOOGLE.map(([fecha, campana, impresiones, clics, inversion, leads]) => ({
    fecha,
    canal: "google" as const,
    campana,
    inversion,
    impresiones,
    alcance: null,
    clics,
    leads,
  })),
];

export const RANGO_DATOS = { desde: "2026-08-16", hasta: "2026-09-14" }; // último día cerrado

/** Hasta dónde llega Meta cargado a mano. Después de esta fecha no hay datos
 *  de Meta: no es que haya gastado cero. */
export const ULTIMO_DIA_META = RANGO_DATOS.hasta;

// ───────────────────────────────────────────────────────────
// RADIOGRAFÍA DEL PÚBLICO
// Meta: desgloses de los últimos 30 días (16 ago – 14 sep).
// Analytics: propiedad "Valle del Sol" (16 ago – 15 sep).
// Son distribuciones del período completo: no cambian con el filtro de
// fechas, y la vista lo dice para no confundir.
// ───────────────────────────────────────────────────────────
export const PUBLICO = {
  periodoMeta: "16 ago – 14 sep 2026",
  periodoGa: "16 ago – 15 sep 2026",

  // [etiqueta, conversaciones, costo de cada una]
  edad: [
    ["18–24", 7, 352],
    ["25–34", 44, 345],
    ["35–44", 54, 452],
    ["45–54", 54, 423],
    ["55–64", 30, 460],
    ["65+", 31, 394],
  ] as Array<[string, number, number]>,

  genero: [
    ["Mujeres", 146, 402],
    ["Hombres", 74, 428],
  ] as Array<[string, number, number]>,

  plataforma: [
    ["Instagram", 125, 344],
    ["Facebook", 95, 504],
  ] as Array<[string, number, number]>,

  ubicaciones: [
    ["Reels de Facebook", 29, 320],
    ["Historias de Facebook", 13, 345],
  ] as Array<[string, number, number]>,

  // [región, gasto, contactos, dentro de la zona]
  regiones: [
    ["Bío Bío y Ñuble", 78072, 173, true],
    ["Santiago", 9288, 32, false],
    ["Maule", 1826, 3, false],
    ["Araucanía", 1089, 2, false],
    ["O'Higgins", 586, 2, false],
    ["Valparaíso", 20, 0, false],
    ["Los Ríos", 2, 0, false],
  ] as Array<[string, number, number, boolean]>,

  ga: {
    usuarios: 710,
    nuevos: 687,
    sesiones: 936,
    interaccion: 0.6763,
    tiempoMedio: "1 min 07 s",
    canales: [
      ["Directo", 304],
      ["Búsqueda orgánica", 297],
      ["Redes sociales", 223],
      ["Referencias", 66],
      ["Búsqueda pagada", 28],
      ["Sin asignar", 18],
    ] as Array<[string, number]>,
    ciudades: [
      ["Santiago", 221],
      ["Concepción", 171],
      ["Chillán", 45],
      ["Temuco", 34],
      ["San Pedro de la Paz", 26],
      ["Talcahuano", 18],
      ["Coronel", 15],
      ["Hualpén", 10],
      ["Los Ángeles", 9],
    ] as Array<[string, number]>,
    granConce: 240, // Concepción + San Pedro + Talcahuano + Coronel + Hualpén
    dispositivo: [
      ["Celular", 507],
      ["Computador", 205],
    ] as Array<[string, number]>,
    sistema: [
      ["Android", 291],
      ["iPhone (iOS)", 216],
      ["Windows", 135],
      ["Mac", 22],
      ["Linux", 19],
      ["Otros", 27],
    ] as Array<[string, number]>,
    paginas: [
      ["Portada", 927],
      ["Cabañas", 374],
      ["Restaurante", 100],
      ["Paseos de curso", 91],
      ["Nosotros", 72],
      ["Matrimonios", 39],
      ["Cotizador de eventos", 37],
    ] as Array<[string, number]>,
    vistasTotales: 1802,
  },

  // Google Ads · términos de búsqueda reales (14–15 sep, recién partiendo)
  terminos: [
    ["hogar de ancianos chiguayante", "Iglesias y retiros", 5, false],
    ["arriendo centro de eventos", "Empresas", 4, true],
    ["salón de eventos la escondida", "Empresas", 4, true],
    ["asilo de ancianos", "Iglesias y retiros", 4, false],
    ["hogar de ancianos concepción", "Iglesias y retiros", 4, false],
    ["centro de eventos concepción", "Empresas", 3, true],
    ["centro eventos", "Empresas", 3, true],
    ["espacio para celebraciones", "Empresas", 3, true],
  ] as Array<[string, string, number, boolean]>,
};

// ───────────────────────────────────────────────────────────
// SALUD DE LA MEDICIÓN
// ───────────────────────────────────────────────────────────
export type Estado = "bien" | "vigilar" | "falta";

export const SALUD: Array<{ que: string; estado: Estado; detalle: string }> = [
  {
    que: "Analytics conectado con Google Ads",
    estado: "bien",
    detalle:
      "Vinculados desde febrero 2023. La campaña importa la conversión real, no una aproximación.",
  },
  {
    que: "Primera conversión de Google registrada",
    estado: "bien",
    detalle:
      "Una persona llegó por el anuncio de cabañas y apretó Reservar, con $537 gastados.",
  },
  {
    que: "Compras falsas del píxel de Meta",
    estado: "vigilar",
    detalle:
      "Bajaron de unas 27 diarias a 4 tras apagar el seguimiento sin código el 14-09. Deberían llegar a cero; si no, la causa era otra.",
  },
  {
    que: "Eventos clave de Analytics con ruido",
    estado: "vigilar",
    detalle:
      "Los 636 del mes mezclan el sitio viejo, que contaba visitas como conversiones, con el nuevo. Desde este mes las cifras quedan limpias.",
  },
  {
    que: "Cambios de público en Meta",
    estado: "vigilar",
    detalle:
      "El recorte a Chillán, Concepción y Los Ángeles quedó hecho el 15-09. Confirmar que diga publicado y no borrador.",
  },
];

export const TAREAS: Array<{ que: string; como: string }> = [
  {
    que: "Publicar los cambios de público en Meta",
    como: "Botón azul «Revisar y publicar», arriba a la derecha del administrador de anuncios.",
  },
  {
    que: "Bloquear en Google: hogar de ancianos, asilo, residencia de ancianos",
    como: "Como palabras negativas de la campaña Eventos · Zona.",
  },
  {
    que: "Mirar si «Comprar» llegó a cero en el píxel",
    como: "Administrador de eventos de Meta, con la fecha de hoy.",
  },
  {
    que: "Verificar valledelsolquillon.cl en Meta",
    como: "Un registro TXT en Cloudflare, donde vive el DNS.",
  },
  {
    que: "Arreglar el horario de la página de Facebook",
    como: "Hoy dice cerrado los jueves, y eso lo ve cualquier cliente.",
  },
  {
    que: "Subir fotos a los anuncios de Cabañas y Marca en Google",
    como: "Las de Eventos ya están; se comparten desde la biblioteca de la cuenta.",
  },
];

