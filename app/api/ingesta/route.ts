// LA INGESTA PROGRAMADA: la llama el cron de Vercel cada mañana (vercel.json)
// con los últimos tres días, para rellenar cualquier hueco. También sirve
// para la carga inicial (?desde=&hasta=) y para limitar fuentes
// (?fuentes=sitio,google). Presupuesto por corrida: Meta 6 llamadas,
// Analytics 4. Ver docs/ARQUITECTURA.md.

import { NextResponse } from "next/server";
import { hoyEnChile, sumarDias, diasEntre } from "../../../lib/calculos";
import { baseConectada } from "../../../lib/base";
import { ingestar, type Fuente } from "../../../lib/ingesta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Un rango largo son muchas páginas de Meta: se acota para que nadie, ni por
 *  error ni a propósito, dispare la paginación completa y queme el cupo. */
const MAX_DIAS = 400;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FUENTES: Fuente[] = ["meta", "meta-publico", "google", "sitio"];

export async function GET(req: Request) {
  // Sin llave configurada la ruta no corre: es preferible que el cron falle a
  // que quede una ingesta abierta en un entorno de pruebas con acceso a las
  // llaves de Meta y Analytics. Vercel manda la llave sola en el cron.
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "falta CRON_SECRET: la ingesta está apagada" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "sin permiso" }, { status: 401 });
  }
  if (!baseConectada()) return NextResponse.json({ error: "la base no está conectada" }, { status: 500 });

  const p = new URL(req.url).searchParams;
  const hoy = hoyEnChile();
  const hasta = p.get("dia") === "hoy" ? hoy : (p.get("hasta") ?? sumarDias(hoy, -1));
  const desde = p.get("desde") ?? sumarDias(hasta, -2);
  if (!FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta) {
    return NextResponse.json({ error: "fechas inválidas: usa desde y hasta con formato 2026-09-19" }, { status: 400 });
  }
  if (diasEntre(desde, hasta) > MAX_DIAS) {
    return NextResponse.json(
      { error: `el rango no puede pasar de ${MAX_DIAS} días; pide la historia por tandas` },
      { status: 400 },
    );
  }

  const pedidas = p.get("fuentes")?.split(",").map((f) => f.trim()).filter(Boolean) ?? [];
  const invalidas = pedidas.filter((f) => !FUENTES.includes(f as Fuente));
  if (invalidas.length) {
    return NextResponse.json({ error: `fuentes desconocidas: ${invalidas.join(", ")}` }, { status: 400 });
  }
  let fuentes = pedidas.length ? (pedidas as Fuente[]) : undefined;
  // Los desgloses de Meta (5 llamadas) se saltan en la carga de historia larga.
  if (p.get("desgloses") === "no") fuentes = (fuentes ?? FUENTES).filter((f) => f !== "meta-publico");

  return NextResponse.json(await ingestar({ desde, hasta, fuentes }));
}
