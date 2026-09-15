"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { fechaLarga, sumarDias, diasEntre, periodoAnterior } from "../lib/calculos";
import { RANGO_DATOS } from "../lib/datos";

// El filtro vive en la dirección de la página (?desde=…&hasta=…). Así el
// enlace se puede compartir y la vista se arma en el servidor con el rango
// ya elegido — que es la misma forma que va a tener cuando los datos vengan
// de las APIs.

const ATAJOS: Array<[string, number]> = [
  ["7 días", 7],
  ["14 días", 14],
  ["30 días", 30],
];

export default function FiltroFechas({ desde, hasta }: { desde: string; hasta: string }) {
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
  const finDatos = RANGO_DATOS.hasta;

  return (
    <div className="filtros">
      <div className="campo">
        <label htmlFor="desde">Desde</label>
        <input
          id="desde"
          type="date"
          value={desde}
          min={RANGO_DATOS.desde}
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
          {ATAJOS.map(([texto, n]) => {
            const d = sumarDias(finDatos, -(n - 1));
            const activo = desde === d && hasta === finDatos;
            return (
              <button key={texto} className="atajo" aria-pressed={activo}
                      onClick={() => aplicar(d, finDatos)}>
                {texto}
              </button>
            );
          })}
          <button
            className="atajo"
            aria-pressed={desde === RANGO_DATOS.desde && hasta === finDatos}
            onClick={() => aplicar(RANGO_DATOS.desde, finDatos)}
          >
            Todo
          </button>
        </div>
      </div>

      <div className="comparado">
        {largo} {largo === 1 ? "día" : "días"} · se compara contra {fechaLarga(previo.desde)} – {fechaLarga(previo.hasta)}
      </div>
    </div>
  );
}
