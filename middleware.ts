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
  matcher: ["/((?!entrar|api/entrar|_next/static|_next/image|favicon.ico).*)"],
};
