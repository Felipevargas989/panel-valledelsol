// LA INGESTA: trae los datos de las tres fuentes y los guarda en la base.
//
// La llama el cron de Vercel cada mañana (vercel.json) con los últimos tres
// días, para rellenar cualquier hueco; también sirve para la carga inicial
// (?desde=&hasta=) y para el botón «Actualizar hoy» (?dia=hoy).
// Presupuesto por corrida: Meta 6 llamadas, Analytics 4. Ver docs/ARQUITECTURA.md.

import { NextResponse } from "next/server";
import { hoyEnChile, sumarDias } from "../../../lib/calculos";
import { ga4Conectado, leerGoogleAds, leerSitioPorDia } from "../../../lib/ga4";
import { metaConectado, leerMetaDias, leerMetaDesglosesDia } from "../../../lib/meta";
import {
  baseConectada, guardarCampanaDia, guardarDesglose, guardarSitioDia, registrarIngesta,
} from "../../../lib/base";

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
  // Los desgloses de Meta (5 llamadas) solo van si se piden: la carga de
  // historia larga los trae aparte para los últimos 90 días.
  const conDesgloses = p.get("desgloses") !== "no";

  const resultado: Record<string, unknown> = { desde, hasta };

  const correr = async (fuente: string, tarea: () => Promise<number>) => {
    const inicio = new Date();
    try {
      const filas = await tarea();
      await registrarIngesta({ fuente, desde, hasta, filas, inicio });
      resultado[fuente] = { filas };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await registrarIngesta({ fuente, desde, hasta, filas: 0, error, inicio });
      resultado[fuente] = { error };
    }
  };

  if (metaConectado()) {
    await correr("meta", async () => guardarCampanaDia(await leerMetaDias(desde, hasta)));
    if (conDesgloses) {
      await correr("meta-publico", async () => guardarDesglose("meta_desglose", await leerMetaDesglosesDia(desde, hasta)));
    }
  } else {
    resultado.meta = { saltado: "sin llave" };
  }

  if (ga4Conectado()) {
    await correr("google", async () => guardarCampanaDia(await leerGoogleAds(desde, hasta)));
    await correr("sitio", async () => {
      const s = await leerSitioPorDia(desde, hasta);
      const n = await guardarSitioDia(s.dias);
      await guardarDesglose("sitio_desglose", s.desgloses);
      return n;
    });
  } else {
    resultado.google = { saltado: "sin llave" };
  }

  return NextResponse.json(resultado);
}
