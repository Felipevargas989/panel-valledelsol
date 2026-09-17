"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const VISTAS = [
  { href: "/conversiones", texto: "Conversiones", icono: "◧" },
  { href: "/sitio", texto: "Sitio", icono: "◉" },
  { href: "/publico", texto: "Público", icono: "◔" },
  { href: "/medicion", texto: "Medición", icono: "◇" },
];

export default function Vistas() {
  const ruta = usePathname();
  const params = useSearchParams();
  const cola = params.toString();

  return (
    <nav className="vistas" aria-label="Vistas del panel">
      {VISTAS.map((v) => (
        <Link
          key={v.href}
          href={cola ? `${v.href}?${cola}` : v.href}
          className="vista"
          aria-current={ruta === v.href ? "page" : undefined}
        >
          <span aria-hidden="true">{v.icono}</span>
          {v.texto}
        </Link>
      ))}
    </nav>
  );
}
