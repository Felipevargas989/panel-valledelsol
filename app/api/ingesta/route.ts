// LA INGESTA PROGRAMADA: la llama el cron de Vercel cada mañana (vercel.json)
// con los últimos tres días, para rellenar cualquier hueco. También sirve
// para la carga inicial (?desde=&hasta=) y para limitar fuentes
// (?fuentes=sitio,google). Presupuesto por corrida: Meta 6 llamadas,
// Analytics 4. Ver docs/ARQUITECTURA.md.

import { NextResponse } from "next/server";
import { hoyEnChile, sumarDias } from "../../../lib/calculos";
import { baseConectada } from "../../../lib/base";
import { ingestar, type Fuente } from "../../../lib/ingesta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel manda el CRON_SECRET solo; a mano hay que pasarlo en la cabecera.
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "sin permiso" }, { status: 401 });
  }
  if (!baseConectada()) return NextResponse.json({ error: "la base no está conectada" }, { status: 500 });

  const p = new URL(req.url).searchParams;
  const hoy = hoyEnChile();
  const hasta = p.get("dia") === "hoy" ? hoy : (p.get("hasta") ?? sumarDias(hoy, -1));
  const desde = p.get("desde") ?? sumarDias(hasta, -2);
  let fuentes = p.get("fuentes")?.split(",").filter(Boolean) as Fuente[] | undefined;
  // Los desgloses de Meta (5 llamadas) se saltan en la carga de historia larga.
  if (p.get("desgloses") === "no") fuentes = (fuentes ?? ["meta", "google", "sitio"]).filter((f) => f !== "meta-publico");

  return NextResponse.json(await ingestar({ desde, hasta, fuentes }));
}
