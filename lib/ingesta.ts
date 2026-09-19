// LA INGESTA COMO FUNCIÓN: la usan el cron (/api/ingesta) y el botón
// «Actualizar hoy» (/api/actualizar). Ver docs/ARQUITECTURA.md.

import { ga4Conectado, leerGoogleAds, leerSitioPorDia } from "./ga4";
import { metaConectado, leerMetaDias, leerMetaDesglosesDia } from "./meta";
import { guardarCampanaDia, guardarDesglose, guardarSitioDia, registrarIngesta } from "./base";

export type Fuente = "meta" | "meta-publico" | "google" | "sitio";

export async function ingestar(opciones: {
  desde: string;
  hasta: string;
  fuentes?: Fuente[];
}) {
  const { desde, hasta } = opciones;
  const fuentes = new Set<Fuente>(opciones.fuentes ?? ["meta", "meta-publico", "google", "sitio"]);
  const resultado: Record<string, unknown> = { desde, hasta };

  const correr = async (fuente: Fuente, tarea: () => Promise<number>) => {
    if (!fuentes.has(fuente)) return;
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
    await correr("meta-publico", async () => guardarDesglose("meta_desglose", await leerMetaDesglosesDia(desde, hasta)));
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

  return resultado;
}
