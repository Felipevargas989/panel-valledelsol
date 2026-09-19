import { NextResponse, type NextRequest } from "next/server";
import { firma, igual } from "./lib/candado";

export async function middleware(req: NextRequest) {
  const clave = process.env.PANEL_CLAVE;
  if (!clave) return NextResponse.next(); // sin candado configurado todavía

  const galleta = req.cookies.get("panel")?.value;
  if (galleta && igual(galleta, await firma(clave))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // /api/ingesta queda fuera del candado: la llama el cron de Vercel sin
  // galleta y se protege sola con CRON_SECRET.
  matcher: ["/((?!entrar|api/entrar|api/ingesta|_next/static|_next/image|favicon.ico).*)"],
};
