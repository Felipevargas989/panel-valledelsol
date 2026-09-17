"use client";

import { useState } from "react";
import { fechaCorta, plata, numero } from "../lib/calculos";

// Next no deja que una página del servidor le pase funciones a un componente
// de navegador, así que el formato viaja como nombre («plata», «numero») y se
// resuelve acá.
const FORMATO = { plata, numero } as const;
export type NombreFormato = keyof typeof FORMATO;

// Los gráficos van dibujados a mano en SVG, sin librería. Así controlo el
// detalle: marcas delgadas, separación entre segmentos, etiquetas que no se
// pisan y un solo eje por gráfico.
//
// Regla que no se rompe: NUNCA dos escalas distintas en el mismo gráfico.
// Cuando hay que comparar dos medidas de tamaño distinto, van dos gráficos
// lado a lado (ver <ParDeGraficos>). Un eje doble hace que dos líneas se vean
// pegadas aunque no tengan relación, y se puede dibujar cualquier conclusión
// moviendo la escala.

const COLOR = {
  google: "var(--google)",
  meta: "var(--meta)",
  sitio: "var(--sitio)",
  otro: "var(--otro)",
  // Google y Meta sumados: sin color de canal, para no sugerir que es uno solo.
  total: "var(--tinta)",
} as const;

export type ClaveColor = keyof typeof COLOR;

/** Escalón redondo para las marcas del eje: 1, 2, 2.5 o 5 por potencia de 10. */
function techo(max: number, pasos = 4) {
  if (max <= 0) return { tope: 1, marcas: [0, 1] };
  const crudo = max / pasos;
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const norm = crudo / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const tope = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(v);
  return { tope, marcas };
}

const corto = (v: number) =>
  v >= 1_000_000 ? (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",") + "M"
  : v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace(".", ",") + "k"
  : String(v);

// ─────────────────────────────────────────────────────────────
// Barras por día, apiladas por canal
// ─────────────────────────────────────────────────────────────
export function BarrasDia({
  datos,
  formato: nombreFormato,
  alto = 200,
}: {
  datos: Array<{ fecha: string; meta: number; google: number; total: number }>;
  formato: NombreFormato;
  alto?: number;
}) {
  const formato = FORMATO[nombreFormato];
  const [sobre, setSobre] = useState<number | null>(null);
  const W = 860, H = alto;
  const L = 54, R = 10, T = 12, B = 28;
  const ancho = W - L - R, altoPlot = H - T - B;
  const { tope, marcas } = techo(Math.max(...datos.map((d) => d.total), 1));
  const paso = ancho / Math.max(datos.length, 1);
  const grosor = Math.max(3, Math.min(22, paso - 3));
  const y = (v: number) => T + altoPlot - (v / tope) * altoPlot;
  const cada = Math.max(1, Math.ceil(datos.length / 9));

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
           aria-label="Inversión por día, separada por canal">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke="var(--borde)" strokeWidth="1" />
            <text x={L - 8} y={y(m) + 4} textAnchor="end" fontSize="10.5" fill="var(--tinta3)"
                  fontFamily="var(--mono)">{corto(m)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = L + i * paso + (paso - grosor) / 2;
          const hMeta = (d.meta / tope) * altoPlot;
          const hGoogle = (d.google / tope) * altoPlot;
          const base = T + altoPlot;
          return (
            <g key={d.fecha}>
              {d.meta > 0 && (
                <rect x={x} y={base - hMeta} width={grosor} height={hMeta}
                      fill={COLOR.meta} rx="3" opacity={sobre === null || sobre === i ? 1 : .38} />
              )}
              {d.google > 0 && (
                /* 2px de aire entre los dos canales para que se lean separados */
                <rect x={x} y={base - hMeta - hGoogle - 2} width={grosor} height={Math.max(hGoogle, 1)}
                      fill={COLOR.google} rx="3" opacity={sobre === null || sobre === i ? 1 : .38} />
              )}
              <rect x={L + i * paso} y={T} width={paso} height={altoPlot} fill="transparent"
                    onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)} />
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={T + altoPlot} y2={T + altoPlot} stroke="var(--borde2)" strokeWidth="1" />
        {datos.map((d, i) =>
          i % cada === 0 ? (
            <text key={d.fecha} x={L + i * paso + paso / 2} y={H - 9} textAnchor="middle"
                  fontSize="10.5" fill="var(--tinta3)">{fechaCorta(d.fecha)}</text>
          ) : null
        )}
      </svg>
      {sobre !== null && datos[sobre] && (
        <Globo
          izq={((L + sobre * paso + paso / 2) / W) * 100}
          titulo={fechaCorta(datos[sobre].fecha)}
          filas={[
            ...(datos[sobre].google > 0 ? [["Google Ads", formato(datos[sobre].google), COLOR.google] as const] : []),
            ...(datos[sobre].meta > 0 ? [["Meta", formato(datos[sobre].meta), COLOR.meta] as const] : []),
            ["Total", formato(datos[sobre].total), "transparent"] as const,
          ]}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Línea por día, una sola medida y un solo eje
// ─────────────────────────────────────────────────────────────
export function LineaDia({
  datos,
  color = "google",
  formato: nombreFormato,
  alto = 170,
  comparar,
}: {
  datos: Array<{ fecha: string; valor: number }>;
  color?: ClaveColor;
  formato: NombreFormato;
  alto?: number;
  /** Misma medida hace un año, día por día y en el mismo orden. Comparte el
   *  eje porque es la misma unidad: no rompe la regla de una sola escala. */
  comparar?: Array<{ fecha: string; valor: number }>;
}) {
  const formato = FORMATO[nombreFormato];
  const [sobre, setSobre] = useState<number | null>(null);
  const W = 860, H = alto;
  const L = 54, R = 10, T = 12, B = 28;
  const ancho = W - L - R, altoPlot = H - T - B;
  const previo = comparar && comparar.length === datos.length ? comparar : null;
  const { tope, marcas } = techo(Math.max(...datos.map((d) => d.valor), ...(previo ?? []).map((d) => d.valor), 1));
  const x = (i: number) => L + (datos.length <= 1 ? ancho / 2 : (i / (datos.length - 1)) * ancho);
  const y = (v: number) => T + altoPlot - (v / tope) * altoPlot;
  const trazo = (serie: Array<{ valor: number }>) =>
    serie.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
  const linea = trazo(datos);
  const area = `${linea} L${x(datos.length - 1).toFixed(1)},${T + altoPlot} L${x(0).toFixed(1)},${T + altoPlot} Z`;
  const cada = Math.max(1, Math.ceil(datos.length / 9));
  const c = COLOR[color];

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Serie por día">
        <defs>
          <linearGradient id={`deg-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity=".18" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke="var(--borde)" strokeWidth="1" />
            <text x={L - 8} y={y(m) + 4} textAnchor="end" fontSize="10.5" fill="var(--tinta3)"
                  fontFamily="var(--mono)">{corto(m)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#deg-${color})`} />
        {previo ? (
          <path d={trazo(previo)} fill="none" stroke={COLOR_ANTERIOR} strokeWidth="1.75"
                strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        <path d={linea} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {sobre !== null && (
          <>
            <line x1={x(sobre)} x2={x(sobre)} y1={T} y2={T + altoPlot} stroke={c} strokeWidth="1" strokeDasharray="3 3" opacity=".55" />
            {previo ? (
              <circle cx={x(sobre)} cy={y(previo[sobre].valor)} r="4" fill={COLOR_ANTERIOR} stroke="var(--tarjeta)" strokeWidth="2" />
            ) : null}
            <circle cx={x(sobre)} cy={y(datos[sobre].valor)} r="5" fill={c} stroke="var(--tarjeta)" strokeWidth="2" />
          </>
        )}
        <line x1={L} x2={W - R} y1={T + altoPlot} y2={T + altoPlot} stroke="var(--borde2)" strokeWidth="1" />
        {datos.map((d, i) =>
          i % cada === 0 ? (
            <text key={d.fecha} x={x(i)} y={H - 9} textAnchor="middle" fontSize="10.5" fill="var(--tinta3)">
              {fechaCorta(d.fecha)}
            </text>
          ) : null
        )}
        {datos.map((d, i) => (
          <rect key={d.fecha} x={x(i) - ancho / datos.length / 2} y={T}
                width={ancho / datos.length} height={altoPlot} fill="transparent"
                onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)} />
        ))}
      </svg>
      {sobre !== null && datos[sobre] && (
        <Globo izq={(x(sobre) / W) * 100} titulo={fechaCorta(datos[sobre].fecha)}
               filas={
                 previo
                   ? [
                       ["Este año", formato(datos[sobre].valor), c],
                       [`Hace un año (${fechaCorta(previo[sobre].fecha)})`, formato(previo[sobre].valor), COLOR_ANTERIOR],
                     ]
                   : [["Valor", formato(datos[sobre].valor), c]]
               } />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mes a mes: este año contra el anterior
// ─────────────────────────────────────────────────────────────
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** El año anterior va siempre en gris: es contexto, no protagonista. */
export const COLOR_ANTERIOR = "#98a3b8";

export function MesesAnio({
  anio,
  actual,
  anterior,
  mesEnCurso,
  diaEnCurso,
  color = "google",
  formato: nombreFormato,
  alto = 210,
}: {
  anio: number;
  actual: Array<number | null>;
  anterior: number[];
  mesEnCurso: number;
  diaEnCurso: number;
  color?: ClaveColor;
  formato: NombreFormato;
  alto?: number;
}) {
  const formato = FORMATO[nombreFormato];
  const [sobre, setSobre] = useState<number | null>(null);
  const W = 860, H = alto;
  const L = 54, R = 10, T = 12, B = 28;
  const ancho = W - L - R, altoPlot = H - T - B;
  const { tope, marcas } = techo(Math.max(...anterior, ...actual.map((v) => v ?? 0), 1));
  const paso = ancho / 12;
  const barra = Math.max(4, Math.min(24, (paso - 10) / 2));
  const y = (v: number) => T + altoPlot - (v / tope) * altoPlot;
  const base = T + altoPlot;
  const c = COLOR[color];

  const cambio = (i: number) => {
    const a = actual[i], p = anterior[i];
    if (a === null || !p) return null;
    const v = (a - p) / p;
    return `${v >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(v * 100))} %`;
  };

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
           aria-label={`Mes a mes, ${anio} contra ${anio - 1}`}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke="var(--borde)" strokeWidth="1" />
            <text x={L - 8} y={y(m) + 4} textAnchor="end" fontSize="10.5" fill="var(--tinta3)"
                  fontFamily="var(--mono)">{corto(m)}</text>
          </g>
        ))}
        {MESES.map((nombre, i) => {
          const x0 = L + i * paso + paso / 2;
          const apagado = sobre !== null && sobre !== i ? .38 : 1;
          const a = actual[i];
          const enCurso = i === mesEnCurso;
          return (
            <g key={nombre}>
              {anterior[i] > 0 && (
                <rect x={x0 - barra - 1} y={y(anterior[i])} width={barra} height={base - y(anterior[i])}
                      fill={COLOR_ANTERIOR} rx="3" opacity={apagado} />
              )}
              {a !== null && a > 0 && (
                <rect x={x0 + 1} y={y(a)} width={barra} height={base - y(a)}
                      fill={c} rx="3" opacity={apagado * (enCurso ? .55 : 1)} />
              )}
              <text x={x0} y={H - 9} textAnchor="middle" fontSize="10.5"
                    fill={enCurso ? "var(--tinta)" : "var(--tinta3)"} fontWeight={enCurso ? 600 : 400}>
                {enCurso ? `${nombre} (al ${diaEnCurso})` : nombre}
              </text>
              <rect x={L + i * paso} y={T} width={paso} height={altoPlot} fill="transparent"
                    onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)} />
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={base} y2={base} stroke="var(--borde2)" strokeWidth="1" />
      </svg>
      {sobre !== null && (
        <Globo
          izq={((L + sobre * paso + paso / 2) / W) * 100}
          titulo={sobre === mesEnCurso ? `${MESES[sobre]}, del 1 al ${diaEnCurso}` : MESES[sobre]}
          filas={[
            [String(anio), actual[sobre] === null ? "todavía no llega" : formato(actual[sobre]), c],
            [String(anio - 1), formato(anterior[sobre]), COLOR_ANTERIOR],
            ...(cambio(sobre) ? [["Cambio", cambio(sobre)!, "transparent"] as const] : []),
          ]}
        />
      )}
    </div>
  );
}

function Globo({
  izq,
  titulo,
  filas,
}: {
  izq: number;
  titulo: string;
  filas: ReadonlyArray<readonly [string, string, string]>;
}) {
  return (
    <div
      style={{
        position: "absolute", top: 0, left: `${Math.min(84, Math.max(16, izq))}%`,
        transform: "translateX(-50%)", background: "var(--tinta)", color: "#fff",
        borderRadius: 8, padding: "8px 11px", fontSize: 12, pointerEvents: "none",
        whiteSpace: "nowrap", boxShadow: "0 6px 18px rgba(16,26,46,.22)", zIndex: 5,
      }}
    >
      <div style={{ opacity: .72, fontSize: 11, marginBottom: 4 }}>{titulo}</div>
      {filas.map(([k, v, c]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block", flex: "none" }} />
          <span style={{ opacity: .78 }}>{k}</span>
          <b style={{ marginLeft: "auto", fontFamily: "var(--mono)" }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

/** Dos gráficos lado a lado con el mismo eje de fechas. Reemplaza al gráfico
 *  de doble eje: cada medida conserva su propia escala honesta. */
export function ParDeGraficos({ a, b }: { a: React.ReactNode; b: React.ReactNode }) {
  return <div className="rejilla dos">{a}{b}</div>;
}

// ─────────────────────────────────────────────────────────────
// Barras horizontales — reemplazan a la dona
// ─────────────────────────────────────────────────────────────
/** Una fila ya resuelta: la página del servidor arma el texto y elige el
 *  color, y este componente sólo dibuja. */
export type FilaBarra = {
  et: string;
  valor: number;
  texto: string;
  detalle?: string;
  color?: ClaveColor;
};

export function BarrasH({ filas, color = "google" }: { filas: FilaBarra[]; color?: ClaveColor }) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <div className="barras">
      {filas.map((f) => (
        <div className="barra" key={f.et}>
          <span className="et" title={f.et}>{f.et}</span>
          <div className="riel">
            <i style={{ width: `${Math.max(2, (f.valor / max) * 100)}%`, background: COLOR[f.color ?? color] }} />
          </div>
          <b className="val">
            {f.texto}
            {f.detalle ? <span style={{ color: "var(--tinta3)" }}> · {f.detalle}</span> : null}
          </b>
        </div>
      ))}
    </div>
  );
}
