import { NextResponse } from "next/server";
import { firma, igual } from "../../../lib/candado";

export const runtime = "edge";

export async function POST(req: Request) {
  const real = process.env.PANEL_CLAVE;
  if (!real) return NextResponse.json({ ok: true, sinCandado: true });

  let clave = "";
  try {
    clave = (await req.json())?.clave ?? "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Se comparan las firmas, no las claves: así ambas tienen el mismo largo
  // y el tiempo de respuesta no delata nada.
  const sello = await firma(real);
  if (!igual(await firma(clave), sello)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("panel", sello, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
