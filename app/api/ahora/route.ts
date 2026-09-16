import { NextResponse } from "next/server";
import { ahoraMismo, ga4Conectado, explicarError } from "../../../lib/ga4";

// Quién está en el sitio en este momento. Lo pide la vista Sitio cada
// minuto. Queda detrás del candado igual que el resto del panel.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!ga4Conectado()) return NextResponse.json({ conectado: false });
  try {
    return NextResponse.json({ conectado: true, datos: await ahoraMismo() });
  } catch (e) {
    return NextResponse.json({ conectado: true, error: explicarError(e) });
  }
}
