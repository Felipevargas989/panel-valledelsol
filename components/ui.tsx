import type { Variacion } from "../lib/calculos";

// Familias de indicador. El color de la tarjeta dice qué tipo de número es,
// no es decoración: volumen (cuánta gente), costo (cuánta plata) y
// eficiencia (qué tan bien convierte).
export type Familia = "volumen" | "costo" | "eficiencia";

export function Kpi({
  rotulo,
  valor,
  familia,
  variacion,
  pie,
}: {
  rotulo: string;
  valor: string;
  familia: Familia;
  variacion?: Variacion;
  pie?: string;
}) {
  return (
    <div className={`kpi ${familia}`}>
      <div className="rotulo">{rotulo}</div>
      <div>
        <div className="cifra">{valor}</div>
        <div className="pie">
          {variacion ? (
            variacion.valor === 0 ? (
              <span className="delta igual">sin cambio</span>
            ) : (
              <span className={`delta ${variacion.neutro ? "igual" : variacion.bueno ? "sube" : "baja"}`}>
                {variacion.valor > 0 ? "▲" : "▼"}&nbsp;{Math.abs(Math.round(variacion.valor * 100))}&nbsp;%
              </span>
            )
          ) : (
            <span className="delta igual">sin comparación</span>
          )}
          <span>{pie ?? "vs. período anterior"}</span>
        </div>
      </div>
    </div>
  );
}

/** La variación como se muestra dentro de una tabla. */
export function Var({ v }: { v: Variacion }) {
  if (!v) return <span className="var neutro">—</span>;
  if (v.valor === 0) return <span className="var neutro">=</span>;
  return (
    <span className={`var ${v.neutro ? "neutro" : v.bueno ? "bueno" : "malo"}`}>
      {v.valor > 0 ? "▲" : "▼"} {Math.abs(Math.round(v.valor * 100))} %
    </span>
  );
}

export function Seccion({
  titulo,
  bajada,
  periodo,
  children,
}: {
  titulo: string;
  bajada?: string;
  periodo?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="encabezado-seccion">
        <h2 className="titulo">{titulo}</h2>
        {periodo ? <span className="periodo-chico">{periodo}</span> : null}
      </div>
      {bajada ? <p className="bajada">{bajada}</p> : null}
      {children}
    </section>
  );
}

export function Tarjeta({
  titulo,
  extra,
  nota,
  children,
}: {
  titulo?: string;
  extra?: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tarjeta">
      {titulo ? (
        <h3>
          <span>{titulo}</span>
          {extra ? <small>{extra}</small> : null}
        </h3>
      ) : null}
      {children}
      {nota ? <p className="nota">{nota}</p> : null}
    </div>
  );
}

export function ChipCanal({ canal }: { canal: "google" | "meta" }) {
  return (
    <span className="chip-canal">
      <i style={{ background: canal === "google" ? "var(--google)" : "var(--meta)" }} />
      {canal === "google" ? "Google Ads" : "Meta"}
    </span>
  );
}

export function Leyenda({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="leyenda">
      {items.map(([texto, color]) => (
        <span key={texto}>
          <i style={{ background: color }} />
          {texto}
        </span>
      ))}
    </div>
  );
}
