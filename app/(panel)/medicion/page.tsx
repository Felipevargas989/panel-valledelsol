import { Seccion, Tarjeta } from "../../../components/ui";
import { SALUD, TAREAS } from "../../../lib/datos";
import { FUENTES } from "../../../lib/fuentes";
import { ga4Conectado } from "../../../lib/ga4";
import { metaConectado, metaResponde } from "../../../lib/meta";
import { dominioVerificadoEnMeta } from "../../../lib/salud";
import { baseConectada, ultimasIngestas, ultimoDiaGuardado, type Ingesta } from "../../../lib/base";
import ActualizarHoy from "../../../components/ActualizarHoy";
import { fechaCorta, numero } from "../../../lib/calculos";

// Se arma en cada visita: muestra si Analytics está conectado en este momento.
export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO = { bien: "Bien", vigilar: "Vigilar", falta: "Falta" } as const;
const NOMBRE_FUENTE: Record<string, string> = {
  meta: "Meta · campañas", "meta-publico": "Meta · público", google: "Google Ads", sitio: "Sitio (Analytics)",
};
const ETIQUETA_CAMPO = {
  medido: "medido",
  disponible: "disponible, falta conectar",
  pendiente: "pendiente de permiso",
} as const;

export default async function Medicion() {
  const enVivo = ga4Conectado();
  const conBase = baseConectada();
  // Con la base propia no hace falta preguntarle a Meta si responde: lo dice
  // la última ingesta.
  const [conMetaVivo, dominioOk, ingestas, ultimoDia] = await Promise.all([
    conBase ? Promise.resolve(true) : metaResponde(),
    dominioVerificadoEnMeta(),
    conBase ? ultimasIngestas(15).catch(() => [] as Ingesta[]) : Promise.resolve([] as Ingesta[]),
    conBase ? ultimoDiaGuardado().catch(() => ({} as Record<string, string | null>)) : Promise.resolve({} as Record<string, string | null>),
  ]);
  const ultimaDe = (fuente: string) => ingestas.find((i) => i.fuente === fuente);
  const conMeta = conBase ? ultimaDe("meta")?.estado !== "error" : conMetaVivo;
  const metaConLlave = metaConectado();

  // Estas filas se comprueban en cada visita; las de SALUD siguen a mano.
  const vivas: typeof SALUD = [
    {
      que: "Dominio verificado en Meta",
      estado: dominioOk ? "bien" : "falta",
      detalle: dominioOk
        ? "valledelsolquillon.cl está verificado (registro TXT en Cloudflare desde el 17-09). El panel lo comprueba en el DNS cada seis horas."
        : "No aparece el registro TXT de Meta en el DNS de valledelsolquillon.cl. Sin eso la medición en iPhone queda coja.",
    },
    {
      que: "Conexión con Meta",
      estado: !metaConLlave ? "falta" : conMeta ? "bien" : "vigilar",
      detalle: !metaConLlave
        ? "Falta la llave META_TOKEN en Vercel."
        : conMeta
          ? "Meta responde. El panel le pregunta una vez al día para no pasarse del cupo de la app."
          : "Meta bloqueó las consultas por exceso de llamadas. Se libera solo; el panel reintenta cada media hora.",
    },
    {
      que: "Conexión con Analytics y Google Ads",
      estado: enVivo ? "bien" : "falta",
      detalle: enVivo
        ? "Analytics responde y Google Ads se lee a través de él, refrescado cada hora."
        : "Falta la llave GA4_CREDENCIALES en Vercel.",
    },
  ];
  if (conBase) {
    const ultima = ingestas[0];
    const fallas = ingestas.filter((i) => i.estado === "error");
    vivas.unshift({
      que: "Base propia del panel",
      estado: !ultima ? "falta" : fallas.length ? "vigilar" : "bien",
      detalle: !ultima
        ? "La base existe pero todavía no tiene ingestas."
        : fallas.length
          ? `De las últimas ${ingestas.length} ingestas, ${fallas.length} fallaron. Detalle en el registro de abajo.`
          : `Datos al ${ultimoDia.meta ? fechaCorta(ultimoDia.meta) : "—"} en Meta y al ${ultimoDia.google ? fechaCorta(ultimoDia.google) : "—"} en Google. La ingesta corre sola cada mañana y las vistas leen solo la base: mirar el panel no gasta cupo de ninguna API.`,
    });
  }
  const salud = [...vivas, ...SALUD];
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
        bajada="Si esto está malo, todos los números de las otras vistas mienten. Las tres primeras filas se comprueban solas en cada visita; el resto se revisa a mano."
      >
        <Tarjeta>
          {salud.map((s) => (
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

      {conBase ? (
        <Seccion
          titulo="Ingestas"
          bajada="Cada vez que el panel trae datos queda anotado acá. La corrida automática es a las 6 de la mañana; el botón trae el día de hoy a pedido (como mucho una vez cada media hora)."
        >
          <Tarjeta>
            <div style={{ marginBottom: 14 }}><ActualizarHoy /></div>
            <div className="tabla-marco">
              <table>
                <thead>
                  <tr><th>Cuándo</th><th>Fuente</th><th>Rango</th><th>Filas</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {ingestas.map((i) => (
                    <tr key={i.id}>
                      <td>{i.inicio.slice(0, 16).replace("T", " ")}</td>
                      <td style={{ textAlign: "left" }}>{NOMBRE_FUENTE[i.fuente] ?? i.fuente}</td>
                      <td>{fechaCorta(i.desde)} – {fechaCorta(i.hasta)}</td>
                      <td className="n">{numero(i.filas)}</td>
                      <td style={{ textAlign: "left" }}>
                        <span className={`marca-estado ${i.estado === "ok" ? "bien" : "falta"}`}>
                          {i.estado === "ok" ? "Bien" : "Falló"}
                        </span>
                        {i.error ? <div style={{ fontSize: 11.5, color: "var(--tinta3)", marginTop: 4 }}>{i.error}</div> : null}
                      </td>
                    </tr>
                  ))}
                  {!ingestas.length ? <tr><td colSpan={5}>Todavía no hay ingestas.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </Seccion>
      ) : null}

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
