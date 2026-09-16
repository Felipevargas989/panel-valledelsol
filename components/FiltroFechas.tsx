"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { fechaLarga, sumarDias, diasEntre, periodoAnterior } from "../lib/calculos";
import { RANGO_DATOS } from "../lib/datos";

// El filtro vive en la dirección de la página (?desde=…&hasta=…). Así el
// enlace se puede compartir y la vista se arma en el servidor con el rango
// ya elegido — que es la misma forma que va a tener cuando los datos vengan
// de las APIs.

export default function FiltroFechas({
  desde,
  hasta,
  min = RANGO_DATOS.desde,
  max = RANGO_DATOS.hasta,
  atajos = [7, 14, 30],
  conTodo = true,
}: {
  desde: string;
  hasta: string;
  /** Primer y último día elegibles. Por defecto, los de la carga manual. */
  min?: string;
  max?: string;
  atajos?: number[];
  conTodo?: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();

  function aplicar(d: string, h: string) {
    const p = new URLSearchParams(params.toString());
    p.set("desde", d);
    p.set("hasta", h);
    router.push(`${ruta}?${p.toString()}`);
  }

  const largo = diasEntre(desde, hasta);
  const previo = periodoAnterior(desde, hasta);
  const finDatos = max;

  return (
    <div className="filtros">
      <div className="campo">
        <label htmlFor="desde">Desde</label>
        <input
          id="desde"
          type="date"
          value={desde}
          min={min}
          max={hasta}
          onChange={(e) => e.target.value && aplicar(e.target.value, hasta)}
        />
      </div>
      <div className="campo">
        <label htmlFor="hasta">Hasta</label>
        <input
          id="hasta"
          type="date"
          value={hasta}
          min={desde}
          max={finDatos}
          onChange={(e) => e.target.value && aplicar(desde, e.target.value)}
        />
      </div>

      <div className="campo">
        <label>Atajos</label>
        <div className="atajos">
          {atajos.map((n) => {
            const texto = `${n} días`;
            const d = sumarDias(finDatos, -(n - 1));
            const activo = desde === d && hasta === finDatos;
            return (
              <button key={texto} className="atajo" aria-pressed={activo}
                      onClick={() => aplicar(d, finDatos)}>
                {texto}
              </button>
            );
          })}
          {conTodo ? (
            <button
              className="atajo"
              aria-pressed={desde === min && hasta === finDatos}
              onClick={() => aplicar(min, finDatos)}
            >
              Todo
            </button>
          ) : null}
        </div>
      </div>

      <div className="comparado">
        {largo} {largo === 1 ? "día" : "días"} · se compara contra {fechaLarga(previo.desde)} – {fechaLarga(previo.hasta)}
      </div>
    </div>
  );
}
