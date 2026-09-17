import { Seccion, Tarjeta } from "../../../components/ui";
import { SALUD, TAREAS } from "../../../lib/datos";
import { FUENTES } from "../../../lib/fuentes";
import { ga4Conectado } from "../../../lib/ga4";
import { metaConectado, metaResponde } from "../../../lib/meta";

// Se arma en cada visita: muestra si Analytics está conectado en este momento.
export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO = { bien: "Bien", vigilar: "Vigilar", falta: "Falta" } as const;
const ETIQUETA_CAMPO = {
  medido: "medido",
  disponible: "disponible, falta conectar",
  pendiente: "pendiente de permiso",
} as const;

export default async function Medicion() {
  const enVivo = ga4Conectado();
  const conMeta = await metaResponde();
  const metaConLlave = metaConectado();
  // Google Ads se lee a través de Analytics, así que cae con la misma llave.
  const conectadas: Record<string, string> = {
    ...(enVivo ? { ga4: "● Conectado en vivo", google: "● En vivo vía Analytics" } : {}),
    ...(conMeta ? { meta: "● Conectado en vivo" } : metaConLlave ? { meta: "⚠ Conectado, Meta no responde" } : {}),
  };
  const PASOS = [
    { que: "Analytics", listo: enVivo, aMedias: false,
      como: "El día a día del sitio, de dónde llega la gente, qué páginas mira y quién está conectado ahora." },
    { que: "Google Ads", listo: enVivo, aMedias: false,
      como: "Se lee a través de Analytics, que está vinculado con la cuenta: sin token de desarrollador. Los términos de búsqueda siguen a mano." },
    { que: "Meta", listo: conMeta, aMedias: metaConLlave && !conMeta,
      como: conMeta || !metaConLlave
        ? "Un usuario del sistema con permiso de solo mirar. Trae gasto, conversaciones y la radiografía del público de todas las campañas."
        : "La llave está puesta, pero Meta bloqueó las consultas por exceso de llamadas (el cupo de una app nueva es bajo). Se desbloquea solo; mientras tanto el panel pregunta una vez al día." },
  ];
  return (
    <div className="pila">
      <Seccion
        titulo="Salud de la medición"
        bajada="Si esto está malo, todos los números de las otras dos vistas mienten. Por eso se revisa primero."
      >
        <Tarjeta>
          {SALUD.map((s) => (
            <div className="salud-fila" key={s.que}>
              <div className="txt">
                <b>{s.que}</b>
                <span>{s.detalle}</span>
              </div>
              <span className={`marca-estado ${s.estado}`}>{ETIQUETA_ESTADO[s.estado]}</span>
            </div>
          ))}
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="Qué hacer esta semana"
        bajada="En orden de lo que más mueve la aguja."
      >
        <Tarjeta>
          <ul className="tareas">
            {TAREAS.map((t, i) => (
              <li key={t.que}>
                <span className="num">{i + 1}</span>
                <span>
                  <b>{t.que}</b>
                  <small>{t.como}</small>
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="De dónde puede salir cada dato"
        bajada="El inventario de lo que entrega cada plataforma. Ningún gráfico del panel dibuja algo que no esté en esta lista: esa es la regla que evita que el panel invente."
      >
        <div className="rejilla dos">
          {FUENTES.map((f) => (
            <Tarjeta key={f.id} titulo={f.nombre} extra={conectadas[f.id] ?? f.dificultad}>
              <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--tinta3)" }}>{f.conexion}</p>
              {f.campos.map((c) => (
                <div className="campo-fuente" key={c.campo}>
                  <i className={`est ${c.estado}`} title={ETIQUETA_CAMPO[c.estado]} />
                  <span style={{ flex: 1 }}>
                    {c.campo}
                    {c.nota ? <em> — {c.nota}</em> : null}
                  </span>
                </div>
              ))}
            </Tarjeta>
          ))}
        </div>

        <div className="leyenda" style={{ marginTop: 14 }}>
          <span><i style={{ background: "var(--bien)" }} />Medido: ya está en el panel</span>
          <span><i style={{ background: "var(--ojo)" }} />Disponible: la plataforma lo da, falta conectarlo</span>
          <span><i style={{ background: "var(--tinta3)" }} />Pendiente: necesita un permiso o una llave</span>
        </div>

      </Seccion>

      <Seccion
        titulo="Qué está conectado"
        bajada="Las tres fuentes del panel y en qué va cada una."
      >
        <Tarjeta>
          {PASOS.map((p) => (
            <div className="salud-fila" key={p.que}>
              <div className="txt">
                <b>{p.que}</b>
                <span>{p.como}</span>
              </div>
              <span className={`marca-estado ${p.listo ? "bien" : p.aMedias ? "vigilar" : "falta"}`}>
                {p.listo ? "En vivo" : p.aMedias ? "No responde" : "Falta"}
              </span>
            </div>
          ))}
        </Tarjeta>
      </Seccion>

      <p className="pie-pagina">
        Las llaves y contraseñas de cada plataforma las administras tú. El panel las lee desde las variables
        del servidor en Vercel; nunca quedan escritas en el código ni pasan por el chat.
      </p>
    </div>
  );
}
