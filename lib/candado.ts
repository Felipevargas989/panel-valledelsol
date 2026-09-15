// EL CANDADO
//
// La clave vive en una variable del servidor (PANEL_CLAVE) que Felipe pone
// en Vercel. Nunca queda escrita en el código ni viaja al navegador.
//
// Lo que sí guarda el navegador es una firma derivada de la clave, no la
// clave. La cookie es httpOnly: ningún script de la página puede leerla.
//
// Si PANEL_CLAVE no está puesta, el panel queda abierto y lo dice en pantalla
// — prefiero que se vea a que dé una falsa sensación de seguridad.

const MENSAJE = "panel-valle-del-sol-v1";

export async function firma(clave: string): Promise<string> {
  const enc = new TextEncoder();
  const llave = await crypto.subtle.importKey(
    "raw",
    enc.encode(clave),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sello = await crypto.subtle.sign("HMAC", llave, enc.encode(MENSAJE));
  return [...new Uint8Array(sello)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara sin delatar en cuántos caracteres se parecen. */
export function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
