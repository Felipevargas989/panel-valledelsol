// QUÉ PUEDE DAR CADA FUENTE
//
// Este archivo existe para que ningún gráfico se invente un dato. Antes de
// dibujar algo, el campo tiene que estar acá y decir de dónde sale.
//
// El estado significa:
//   medido    → lo saqué a mano el 15-09-2026 y está en datos.ts
//   disponible → la plataforma lo entrega, falta conectarlo
//   pendiente  → necesita un permiso o una llave que todavía no existe

export type EstadoCampo = "medido" | "disponible" | "pendiente";

export type Campo = {
  campo: string;
  estado: EstadoCampo;
  nota?: string;
};

export type Fuente = {
  id: string;
  nombre: string;
  conexion: string;
  dificultad: string;
  campos: Campo[];
};

export const FUENTES: Fuente[] = [
  {
    id: "meta",
    nombre: "Meta (Facebook e Instagram)",
    conexion: "API de Marketing · usuario del sistema «panel» con permiso de solo mirar el rendimiento",
    dificultad: "Conectado el 16-09",
    campos: [
      { campo: "Gasto por día y por campaña", estado: "medido" },
      { campo: "Impresiones y alcance por día", estado: "medido" },
      { campo: "Clics al enlace por día", estado: "medido" },
      { campo: "Conversaciones de WhatsApp iniciadas por día", estado: "medido" },
      { campo: "Costo por conversación", estado: "medido" },
      { campo: "Edad y género de quien escribe", estado: "medido" },
      { campo: "Región", estado: "medido", nota: "cuenta contactos, no conversaciones iniciadas; no baja a ciudad" },
      { campo: "Instagram contra Facebook", estado: "medido" },
      { campo: "Reels, Historias, Feed", estado: "medido" },
      { campo: "Frecuencia (cuántas veces ve el anuncio la misma persona)", estado: "disponible" },
      { campo: "Hora del día", estado: "disponible", nota: "sirve para decidir el horario de los anuncios" },
      { campo: "Desglose por anuncio (qué foto rinde mejor)", estado: "disponible" },
    ],
  },
  {
    id: "google",
    nombre: "Google Ads",
    conexion: "Se lee a través de Analytics, que está vinculado con la cuenta. La API propia de Google Ads (con token de desarrollador) solo haría falta para los términos de búsqueda",
    dificultad: "Conectado vía Analytics; términos de búsqueda a mano",
    campos: [
      { campo: "Impresiones, clics, CTR y costo por día", estado: "medido" },
      { campo: "Conversiones y costo por conversión", estado: "medido" },
      { campo: "Desglose por campaña y grupo de anuncios", estado: "medido" },
      { campo: "Términos de búsqueda reales", estado: "medido", nota: "de acá salen las palabras a bloquear" },
      { campo: "Palabra clave que gatilló el clic", estado: "disponible" },
      { campo: "Cuota de impresiones", estado: "disponible", nota: "cuánto del mercado te estás perdiendo por presupuesto" },
      { campo: "Dispositivo y ubicación", estado: "disponible" },
      { campo: "Hora y día de la semana", estado: "disponible" },
    ],
  },
  {
    id: "ga4",
    nombre: "Google Analytics (el sitio)",
    conexion: "API de datos de GA4 · cuenta de servicio de solo lectura",
    dificultad: "Conectado el 16-09",
    campos: [
      { campo: "Usuarios, sesiones y usuarios nuevos", estado: "medido" },
      { campo: "De dónde llegan (directo, buscador, redes, pago)", estado: "medido" },
      { campo: "Ciudad y país", estado: "medido" },
      { campo: "Celular contra computador, y sistema operativo", estado: "medido" },
      { campo: "Páginas más vistas", estado: "medido" },
      { campo: "Eventos clave: whatsapp, cotizar, reservar", estado: "medido" },
      { campo: "Serie por día de todo lo anterior", estado: "medido", nota: "en vivo desde el 16-09" },
      { campo: "Página por la que entran", estado: "medido" },
      { campo: "Página por la que se van", estado: "disponible" },
      { campo: "Recorrido hasta la conversión", estado: "disponible" },
    ],
  },
];
