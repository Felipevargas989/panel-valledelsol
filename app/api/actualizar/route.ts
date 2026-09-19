// EL BOTÓN «ACTUALIZAR HOY»: trae el día en curso a pedido, con freno.
// Como mucho una vez cada 30 minutos, para no gastar el cupo de Meta.

import { NextResponse } from "next/server";
import { hoyEnChile, sumarDias } from "../../../lib/calculos";
import { baseConectada, ultimaIngestaDeHoy } from "../../../lib/base";
import { ingestar } from "../../../lib/ingesta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRENO_MIN = 30;

export async function POST() {
  if (!baseConectada()) return NextResponse.json({ error: "la base no está conectada" }, { status: 500 });
  const hoy = hoyEnChile();
  const ultima = await ultimaIngestaDeHoy(hoy);
  if (ultima) {
    const hace = (Date.now() - new Date(ultima).getTime()) / 60000;
    if (hace < FRENO_MIN) {
      return NextResponse.json(
        { error: `Se actualizó hace ${Math.round(hace)} min. Se puede de nuevo en ${Math.ceil(FRENO_MIN - hace)} min.` },
        { status: 429 },
      );
    }
  }
  // Ayer y hoy: por si la corrida de la mañana todavía no pasó.
  const r = await ingestar({ desde: sumarDias(hoy, -1), hasta: hoy });
  return NextResponse.json(r);
}
