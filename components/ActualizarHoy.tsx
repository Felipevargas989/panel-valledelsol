"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Trae el día en curso a pedido. El servidor pone el freno (una vez cada 30
// minutos) para no gastar el cupo de Meta.
export default function ActualizarHoy() {
  const router = useRouter();
  const [estado, setEstado] = useState<"quieto" | "cargando" | "listo" | "error">("quieto");
  const [mensaje, setMensaje] = useState("");
  const [, refrescar] = useTransition();

  async function actualizar() {
    setEstado("cargando");
    setMensaje("Pidiendo el día de hoy a Meta y Analytics…");
    try {
      const r = await fetch("/api/actualizar", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setEstado("error");
        setMensaje(j.error ?? "No se pudo actualizar.");
        return;
      }
      const fallas = Object.entries(j).filter(([, v]) => typeof v === "object" && v && "error" in (v as object));
      setEstado(fallas.length ? "error" : "listo");
      setMensaje(
        fallas.length
          ? `Se actualizó con problemas: ${fallas.map(([k]) => k).join(", ")}. Mira el registro de abajo.`
          : "Listo: el panel ya tiene el día de hoy.",
      );
      refrescar(() => router.refresh());
    } catch {
      setEstado("error");
      setMensaje("No se pudo conectar con el panel. Prueba de nuevo en un minuto.");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button className="atajo" onClick={actualizar} disabled={estado === "cargando"} aria-busy={estado === "cargando"}>
        {estado === "cargando" ? "Actualizando…" : "Actualizar hoy"}
      </button>
      {mensaje ? (
        <span style={{ fontSize: 12.5, color: estado === "error" ? "var(--mal)" : "var(--tinta2)" }}>{mensaje}</span>
      ) : null}
    </div>
  );
}
