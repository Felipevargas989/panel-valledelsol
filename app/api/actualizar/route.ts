// EL BOTÓN «ACTUALIZAR HOY»: trae el día en curso a pedido, con freno.
//
// Como mucho una vez cada 30 minutos, para no gastar el cupo de Meta. Solo
// acepta llamadas hechas desde el propio panel; la protección de verdad es el
// candado (PANEL_CLAVE), que además cubre esta ruta desde el middleware.

import { NextResponse } from "next/server";
import { hoyEnChile, sumarDias } from "../../../lib/calculos";
import { baseConectada, minutosDesdeUltimaIngestaDeHoy } from "../../../lib/base";
import { ingestar } from "../../../lib/ingesta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRENO_MIN = 30;

/** Mientras no haya candado, al menos se exige que la llamada venga del
 *  propio panel y no de una dirección pegada en otra página. */
function vieneDelPanel(req: Request) {
  const origen = req.headers.get("origin");
  const anfitrion = req.headers.get("host");
  if (!origen || !anfitrion) return false;
  try {
    return new URL(origen).host === anfitrion;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!vieneDelPanel(req)) return NextResponse.json({ error: "sin permiso" }, { status: 403 });
  if (!baseConectada()) return NextResponse.json({ error: "la base no está conectada" }, { status: 500 });

  const hoy = hoyEnChile();
  const hace = await minutosDesdeUltimaIngestaDeHoy(hoy);
  if (hace !== null && hace < FRENO_MIN) {
    return NextResponse.json(
      { error: `Se actualizó hace ${Math.round(hace)} min. Se puede de nuevo en ${Math.ceil(FRENO_MIN - hace)} min.` },
      { status: 429 },
    );
  }
  // Ayer y hoy: por si la corrida de la mañana todavía no pasó.
  const r = await ingestar({ desde: sumarDias(hoy, -1), hasta: hoy });
  return NextResponse.json(r);
}
