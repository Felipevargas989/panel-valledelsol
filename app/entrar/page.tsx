"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Entrar() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [yendo, setYendo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setYendo(true);
    setError("");
    try {
      const r = await fetch("/api/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      if (r.ok) {
        router.replace("/dinero");
        router.refresh();
      } else {
        setError("Esa clave no es. Prueba de nuevo.");
        setYendo(false);
      }
    } catch {
      setError("No se pudo conectar. Revisa la señal e intenta otra vez.");
      setYendo(false);
    }
  }

  return (
    <div className="entrar-fondo">
      <form className="entrar-caja" onSubmit={enviar}>
        <h1>Panel Valle del Sol</h1>
        <p>Esta página es privada. Entra con tu clave.</p>
        <label htmlFor="clave" style={{ display: "none" }}>Clave</label>
        <input
          id="clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Clave"
          autoFocus
          autoComplete="current-password"
        />
        <button type="submit" disabled={yendo || !clave}>
          {yendo ? "Entrando…" : "Entrar"}
        </button>
        {error ? <p className="entrar-error">{error}</p> : null}
      </form>
    </div>
  );
}
