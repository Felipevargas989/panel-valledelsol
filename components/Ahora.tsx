"use client";

import { useEffect, useState } from "react";
import { BarrasH } from "./graficos";
import type { Ahora as DatosAhora } from "../lib/ga4";

// «Ahora mismo»: lo mismo que muestra Analytics en su tarjeta de tiempo
// real. Se pide cada minuto y se pausa cuando la pestaña no está a la vista,
// para no gastar cuota con el panel abierto de fondo.

type Respuesta = { conectado: boolean; datos?: DatosAhora; error?: string };

export default function Ahora() {
  const [r, setR] = useState<Respuesta | null>(null);
  const [hace, setHace] = useState(0);

  useEffect(() => {
    let vivo = true;
    // La primera consulta va siempre: si la pestaña se abre de fondo y no se
    // pide nada, la tarjeta se queda en «Consultando Analytics…» para siempre.
    // Las siguientes sí respetan la visibilidad, para no gastar cuota.
    async function pedir(forzar = false) {
      if (document.hidden && !forzar) return;
      try {
        const res = await fetch("/api/ahora", { cache: "no-store" });
        const j: Respuesta = await res.json();
        if (vivo) setR(j);
      } catch {
        if (vivo) setR({ conectado: true, error: "Sin conexión. Se reintenta en un minuto." });
      }
    }
    pedir(true);
    const cada = setInterval(() => pedir(), 60_000);
    const alVolver = () => !document.hidden && pedir(true);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearInterval(cada);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (r?.datos) setHace(Math.max(0, Math.round((Date.now() - Date.parse(r.datos.medidoEn)) / 1000)));
    }, 5000);
    return () => clearInterval(t);
  }, [r]);

  if (!r) return <div className="tarjeta" style={{ minHeight: 150, color: "var(--tinta3)" }}>Consultando Analytics…</div>;
  if (!r.conectado) return null;
  if (r.error || !r.datos) return <div className="aviso ojo">{r.error}</div>;

  const d = r.datos;
  const max = Math.max(...d.porMinuto, 1);

  return (
    <div className="rejilla tres">
      <div className="tarjeta">
        <h3>
          <span>Personas en el sitio</span>
          <small>últimos 30 minutos</small>
        </h3>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 44, fontWeight: 600, letterSpacing: "-.02em" }}>
            {d.total}
          </span>
          <span className="en-vivo">
            <i />
            en vivo
          </span>
        </div>
        <svg viewBox="0 0 300 54" width="100%" height="54" role="img" aria-label="Personas activas por minuto"
             style={{ marginTop: 10 }}>
          {d.porMinuto.map((v, i) => {
            const alto = (v / max) * 46;
            return (
              <rect key={i} x={i * 10 + 1} y={50 - Math.max(alto, v > 0 ? 3 : 1)} width={8}
                    height={Math.max(alto, v > 0 ? 3 : 1)} rx={2}
                    fill={v > 0 ? "var(--sitio)" : "var(--borde)"}>
                <title>{`hace ${29 - i} min: ${v}`}</title>
              </rect>
            );
          })}
        </svg>
        <p className="nota" style={{ marginTop: 6 }}>
          Cada barra es un minuto, la última es ahora.{" "}
          {hace > 0 ? `Actualizado hace ${hace < 60 ? `${hace} s` : `${Math.round(hace / 60)} min`}.` : "Recién actualizado."}
        </p>
      </div>

      <div className="tarjeta">
        <h3><span>Desde dónde</span><small>ahora</small></h3>
        {d.ciudades.length ? (
          <BarrasH color="sitio" filas={d.ciudades.map(([et, v]) => ({ et, valor: v, texto: String(v) }))} />
        ) : (
          <p className="nota" style={{ marginTop: 0 }}>Nadie en este momento.</p>
        )}
      </div>

      <div className="tarjeta">
        <h3><span>Qué están mirando</span><small>ahora</small></h3>
        {d.pantallas.length ? (
          <BarrasH color="sitio" filas={d.pantallas.map(([et, v]) => ({ et, valor: v, texto: String(v) }))} />
        ) : (
          <p className="nota" style={{ marginTop: 0 }}>Nadie en este momento.</p>
        )}
      </div>
    </div>
  );
}
