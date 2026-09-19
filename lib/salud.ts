// COMPROBACIONES VIVAS DE LA SALUD DE LA MEDICIÓN
//
// La lista de salud partió escrita a mano y se quedaba vieja: el 18-09 seguía
// diciendo «dominio sin verificar» un día después de verificarlo. Lo que se
// pueda comprobar solo, se comprueba acá.

import { resolveTxt } from "node:dns/promises";
import { unstable_cache } from "next/cache";

const DOMINIO = "valledelsolquillon.cl";

/** Meta verifica el dominio con un registro TXT «facebook-domain-verification».
 *  Si el registro está en el DNS, la verificación sigue en pie. */
async function consultarTxtMeta(): Promise<boolean> {
  try {
    const registros = await resolveTxt(DOMINIO);
    return registros.some((r) => r.join("").startsWith("facebook-domain-verification="));
  } catch {
    return false;
  }
}

export const dominioVerificadoEnMeta = unstable_cache(consultarTxtMeta, ["dns-txt-meta-v1"], { revalidate: 6 * 3600 });
