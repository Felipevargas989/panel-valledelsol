import { Seccion, Tarjeta } from "../../../components/ui";
import { SALUD, TAREAS } from "../../../lib/datos";
import { FUENTES, LO_QUE_FALTA } from "../../../lib/fuentes";
import { ga4Conectado } from "../../../lib/ga4";

// Se arma en cada visita: muestra si Analytics está conectado en este momento.
export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO = { bien: "Bien", vigilar: "Vigilar", falta: "Falta" } as const;
const ETIQUETA_CAMPO = {
  medido: "medido",
  disponible: "disponible, falta conectar",
  pendiente: "pendiente de permiso",
} as const;

export default function Medicion() {
  const conectadas: Record<string, boolean> = { ga4: ga4Conectado() };
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
            <Tarjeta key={f.id} titulo={f.nombre} extra={conectadas[f.id] ? "● Conectado en vivo" : f.dificultad}>
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

        <div className="aviso ojo" style={{ marginTop: 14 }}>
          <b>Lo único que el panel todavía no puede saber de verdad.</b> {LO_QUE_FALTA}
        </div>
      </Seccion>

      <Seccion
        titulo="Cómo se conecta esto de verdad"
        bajada="El orden en que conviene hacerlo, de lo más fácil a lo más lento."
      >
        <Tarjeta>
          <ul className="tareas">
            <li>
              <span className="num">1</span>
              <span>
                <b>Analytics</b>
                <small>Gratis y sin trámite. Da el día a día del sitio, de dónde llega la gente y qué páginas mira. Un día de trabajo.</small>
              </span>
            </li>
            <li>
              <span className="num">2</span>
              <span>
                <b>Meta</b>
                <small>Una llave que se genera en el negocio, sin aprobación de nadie. Diez minutos tuyos y el panel queda al día solo.</small>
              </span>
            </li>
            <li>
              <span className="num">3</span>
              <span>
                <b>Eventia</b>
                <small>Es tu propia base. Acá el trabajo no es técnico sino decidir qué mostrar. Esto es lo que convierte el ingreso estimado en plata contada.</small>
              </span>
            </li>
            <li>
              <span className="num">4</span>
              <span>
                <b>Google Ads</b>
                <small>Queda al final porque necesita un token de desarrollador que Google aprueba en días. Mientras tanto, la carga sigue a mano una vez por semana.</small>
              </span>
            </li>
          </ul>
        </Tarjeta>
      </Seccion>

      <p className="pie-pagina">
        Las llaves y contraseñas de cada plataforma las administras tú. El panel las lee desde las variables
        del servidor en Vercel; nunca quedan escritas en el código ni pasan por el chat.
      </p>
    </div>
  );
}
