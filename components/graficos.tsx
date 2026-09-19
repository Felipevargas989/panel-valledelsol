"use client";

import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Brush, Cell,
} from "recharts";
import { fechaCorta, plata, numero } from "../lib/calculos";

// Next no deja que una página del servidor le pase funciones a un componente
// de navegador, así que el formato viaja como nombre («plata», «numero») y se
// resuelve acá.
const FORMATO = { plata, numero } as const;
export type NombreFormato = keyof typeof FORMATO;

// Sprint 3 (19-09-2026): los gráficos pasan de SVG dibujado a mano a Recharts,
// para tener cursor, zoom por arrastre (la barra de abajo) y series que se
// encienden y apagan desde la leyenda. Lo que NO cambia son las reglas:
//
// - NUNCA dos escalas distintas en el mismo gráfico. Cuando hay que comparar
//   dos medidas de tamaño distinto, van dos gráficos lado a lado
//   (<ParDeGraficos>). La única segunda serie admitida es la misma medida en
//   otro período (hace un año), que comparte eje porque es la misma unidad.
// - El color significa algo: Google azul, Meta naranja, sitio verde azulado,
//   año anterior gris. Verde y rojo se reservan para mejoró / empeoró.
// - Sin animaciones: el gráfico aparece terminado y respeta a quien pidió
//   menos movimiento en su sistema.

const COLOR = {
  google: "var(--google)",
  meta: "var(--meta)",
  sitio: "var(--sitio)",
  otro: "var(--otro)",
  // Google y Meta sumados: sin color de canal, para no sugerir que es uno solo.
  total: "var(--tinta)",
} as const;

export type ClaveColor = keyof typeof COLOR;

/** El año anterior va siempre en gris: es contexto, no protagonista. */
export const COLOR_ANTERIOR = "#98a3b8";

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

// Desde cuántos puntos aparece la barra de zoom (arrastrar para acercar).
const PUNTOS_PARA_ZOOM = 21;

const EJE = { fontSize: 10.5, fill: "var(--tinta3)" } as const;
const REJILLA = { stroke: "var(--borde)", vertical: false } as const;

// ─────────────────────────────────────────────────────────────
// Globo: la ventanita que sigue al cursor
// ─────────────────────────────────────────────────────────────
type FilaGlobo = readonly [string, string, string];

function Globo({ titulo, filas }: { titulo: string; filas: ReadonlyArray<FilaGlobo> }) {
  return (
    <div
      style={{
        background: "var(--tinta)", color: "#fff", borderRadius: 8, padding: "8px 11px", fontSize: 12,
        whiteSpace: "nowrap", boxShadow: "0 6px 18px rgba(16,26,46,.22)",
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

// ─────────────────────────────────────────────────────────────
// Leyenda con series que se apagan y se encienden
// ─────────────────────────────────────────────────────────────
function useOcultas() {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const alternar = (clave: string) =>
    setOcultas((o) => {
      const n = new Set(o);
      if (n.has(clave)) n.delete(clave); else n.add(clave);
      return n;
    });
  return { ocultas, alternar };
}

function LeyendaClic({
  series, ocultas, alternar,
}: {
  series: Array<{ clave: string; nombre: string; color: string; punteada?: boolean }>;
  ocultas: Set<string>;
  alternar: (clave: string) => void;
}) {
  return (
    <div className="leyenda" style={{ marginTop: 10, gap: 14 }}>
      {series.map((s) => {
        const apagada = ocultas.has(s.clave);
        return (
          <button
            key={s.clave} type="button" onClick={() => alternar(s.clave)} aria-pressed={!apagada}
            title={apagada ? "Mostrar" : "Ocultar"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0,
              padding: 0, cursor: "pointer", font: "inherit", color: "inherit",
              opacity: apagada ? .45 : 1, textDecoration: apagada ? "line-through" : "none",
            }}
          >
            <i style={{
              width: 10, height: s.punteada ? 0 : 10, borderRadius: 2, display: "inline-block",
              background: s.punteada ? "none" : s.color, borderTop: s.punteada ? `2px dashed ${s.color}` : "none",
            }} />
            {s.nombre}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Barras por día, apiladas por canal
// ─────────────────────────────────────────────────────────────
export function BarrasDia({
  datos,
  formato: nombreFormato,
  alto = 220,
}: {
  datos: Array<{ fecha: string; meta: number; google: number; total: number }>;
  formato: NombreFormato;
  alto?: number;
}) {
  const formato = FORMATO[nombreFormato];
  const { ocultas, alternar } = useOcultas();
  const { tope, marcas } = techo(Math.max(...datos.map((d) =>
    (ocultas.has("meta") ? 0 : d.meta) + (ocultas.has("google") ? 0 : d.google)), 1));

  return (
    <div>
      <ResponsiveContainer width="100%" height={alto}>
        <ComposedChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid {...REJILLA} />
          <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={EJE} axisLine={{ stroke: "var(--borde2)" }}
                 tickLine={false} minTickGap={28} />
          <YAxis tickFormatter={corto} tick={{ ...EJE, fontFamily: "var(--mono)" }} axisLine={false}
                 tickLine={false} width={48} domain={[0, tope]} ticks={marcas} />
          <Tooltip
            cursor={{ fill: "rgba(16,26,46,.06)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { meta: number; google: number; total: number };
              return (
                <Globo titulo={fechaCorta(String(label))} filas={[
                  ...(!ocultas.has("google") && d.google > 0 ? [["Google Ads", formato(d.google), COLOR.google] as const] : []),
                  ...(!ocultas.has("meta") && d.meta > 0 ? [["Meta", formato(d.meta), COLOR.meta] as const] : []),
                  ["Total", formato((ocultas.has("meta") ? 0 : d.meta) + (ocultas.has("google") ? 0 : d.google)), "transparent"] as const,
                ]} />
              );
            }}
          />
          <Bar dataKey="meta" stackId="dia" fill={COLOR.meta} hide={ocultas.has("meta")} isAnimationActive={false}
               radius={[0, 0, 3, 3]} />
          <Bar dataKey="google" stackId="dia" fill={COLOR.google} hide={ocultas.has("google")} isAnimationActive={false}
               radius={[3, 3, 0, 0]} />
          {datos.length > PUNTOS_PARA_ZOOM ? (
            <Brush dataKey="fecha" height={22} travellerWidth={8} tickFormatter={fechaCorta}
                   stroke="var(--borde2)" fill="var(--fondo)" />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      <LeyendaClic ocultas={ocultas} alternar={alternar} series={[
        { clave: "google", nombre: "Google Ads", color: COLOR.google },
        { clave: "meta", nombre: "Meta", color: COLOR.meta },
      ]} />
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
  alto = 190,
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
  const { ocultas, alternar } = useOcultas();
  const c = COLOR[color];
  const previo = comparar && comparar.length === datos.length ? comparar : null;
  const filas = datos.map((d, i) => ({ fecha: d.fecha, valor: d.valor, anterior: previo?.[i]?.valor, fechaAnterior: previo?.[i]?.fecha }));
  const id = `deg-${color}`;
  const { tope, marcas } = techo(Math.max(
    ...(ocultas.has("valor") ? [] : datos.map((d) => d.valor)),
    ...(previo && !ocultas.has("anterior") ? previo.map((d) => d.valor) : []),
    1,
  ));

  return (
    <div>
      <ResponsiveContainer width="100%" height={alto}>
        <ComposedChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity=".18" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid {...REJILLA} />
          <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={EJE} axisLine={{ stroke: "var(--borde2)" }}
                 tickLine={false} minTickGap={28} />
          <YAxis tickFormatter={corto} tick={{ ...EJE, fontFamily: "var(--mono)" }} axisLine={false}
                 tickLine={false} width={48} domain={[0, tope]} ticks={marcas} />
          <Tooltip
            cursor={{ stroke: c, strokeDasharray: "3 3", opacity: .55 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { valor: number; anterior?: number; fechaAnterior?: string };
              return (
                <Globo titulo={fechaCorta(String(label))} filas={
                  previo
                    ? [
                        ...(!ocultas.has("valor") ? [["Este año", formato(d.valor), c] as const] : []),
                        ...(!ocultas.has("anterior") && d.fechaAnterior
                          ? [[`Hace un año (${fechaCorta(d.fechaAnterior)})`, formato(d.anterior ?? 0), COLOR_ANTERIOR] as const]
                          : []),
                      ]
                    : [["Valor", formato(d.valor), c] as const]
                } />
              );
            }}
          />
          <Area type="monotone" dataKey="valor" stroke="none" fill={`url(#${id})`} hide={ocultas.has("valor")}
                isAnimationActive={false} activeDot={false} />
          {previo ? (
            <Line type="monotone" dataKey="anterior" stroke={COLOR_ANTERIOR} strokeWidth={1.75} strokeDasharray="5 4"
                  dot={false} activeDot={{ r: 4, fill: COLOR_ANTERIOR, stroke: "var(--tarjeta)", strokeWidth: 2 }}
                  hide={ocultas.has("anterior")} isAnimationActive={false} />
          ) : null}
          <Line type="monotone" dataKey="valor" stroke={c} strokeWidth={2} dot={false}
                activeDot={{ r: 5, fill: c, stroke: "var(--tarjeta)", strokeWidth: 2 }}
                hide={ocultas.has("valor")} isAnimationActive={false} />
          {filas.length > PUNTOS_PARA_ZOOM ? (
            <Brush dataKey="fecha" height={22} travellerWidth={8} tickFormatter={fechaCorta}
                   stroke="var(--borde2)" fill="var(--fondo)" />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      {previo ? (
        <LeyendaClic ocultas={ocultas} alternar={alternar} series={[
          { clave: "valor", nombre: "Este período", color: c },
          { clave: "anterior", nombre: "Hace un año", color: COLOR_ANTERIOR, punteada: true },
        ]} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mes a mes: este año contra el anterior
// ─────────────────────────────────────────────────────────────
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function MesesAnio({
  anio,
  actual,
  anterior,
  mesEnCurso,
  diaEnCurso,
  color = "google",
  formato: nombreFormato,
  alto = 230,
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
  const { ocultas, alternar } = useOcultas();
  const c = COLOR[color];
  const filas = MESES.map((mes, i) => ({
    mes: i === mesEnCurso ? `${mes} (al ${diaEnCurso})` : mes,
    indice: i,
    anterior: anterior[i],
    actual: actual[i],
  }));

  const { tope, marcas } = techo(Math.max(
    ...(ocultas.has("anterior") ? [] : anterior),
    ...(ocultas.has("actual") ? [] : actual.map((v) => v ?? 0)),
    1,
  ));

  const cambio = (i: number) => {
    const a = actual[i], p = anterior[i];
    if (a === null || !p) return null;
    const v = (a - p) / p;
    return `${v >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(v * 100))} %`;
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%" barGap={2}>
          <CartesianGrid {...REJILLA} />
          <XAxis dataKey="mes" tick={EJE} axisLine={{ stroke: "var(--borde2)" }} tickLine={false} interval={0} />
          <YAxis tickFormatter={corto} tick={{ ...EJE, fontFamily: "var(--mono)" }} axisLine={false}
                 tickLine={false} width={48} domain={[0, tope]} ticks={marcas} />
          <Tooltip
            cursor={{ fill: "rgba(16,26,46,.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { indice: number; actual: number | null; anterior: number };
              const i = d.indice;
              const titulo = i === mesEnCurso ? `${MESES[i]}, del 1 al ${diaEnCurso}` : MESES[i];
              return (
                <Globo titulo={titulo} filas={[
                  ...(!ocultas.has("actual") ? [[String(anio), d.actual === null ? "todavía no llega" : formato(d.actual), c] as const] : []),
                  ...(!ocultas.has("anterior") ? [[String(anio - 1), formato(d.anterior), COLOR_ANTERIOR] as const] : []),
                  ...(cambio(i) ? [["Cambio", cambio(i)!, "transparent"] as const] : []),
                ]} />
              );
            }}
          />
          <Bar dataKey="anterior" fill={COLOR_ANTERIOR} hide={ocultas.has("anterior")} isAnimationActive={false}
               radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" fill={c} hide={ocultas.has("actual")} isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {/* El mes en curso va más claro: está a medias. */}
            {filas.map((f) => <Cell key={f.indice} opacity={f.indice === mesEnCurso ? .55 : 1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <LeyendaClic ocultas={ocultas} alternar={alternar} series={[
        { clave: "actual", nombre: String(anio), color: c },
        { clave: "anterior", nombre: String(anio - 1), color: COLOR_ANTERIOR },
      ]} />
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
