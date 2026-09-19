import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import Ahora from "../../../components/Ahora";
import { BarrasH, LineaDia, MesesAnio, ParDeGraficos, type FilaBarra } from "../../../components/graficos";
import { Kpi, Seccion, Tarjeta } from "../../../components/ui";
import { datosSitio, visitasPorDia, ga4Conectado, explicarError, type DatosSitio } from "../../../lib/ga4";
import { baseConectada, sitioDesdeBase, visitasDesdeBase, INICIO_BASE } from "../../../lib/base";
import {
  variacion, numero, porcentaje, sumarDias, fechaLarga, hoyEnChile, duracionTexto as duracion,
  haceUnAnio, mesesDelAnio,
} from "../../../lib/calculos";

export const dynamic = "force-dynamic";

// El primer día con datos en la propiedad de Analytics de Valle del Sol.
const INICIO_GA4 = "2023-02-11";

const tasa = (conv: number, ses: number) => (ses > 0 ? conv / ses : NaN);

/** Tiñe la celda según su peso en el total, igual que en la vista Dinero. */
const tinte = (parte: number) => `rgba(13,148,136,${(Math.min(1, Math.max(0, parte)) * 0.22).toFixed(3)})`;

export default async function Sitio({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const conBase = baseConectada();
  if (!conBase && !ga4Conectado()) return <SinConectar />;

  // Analytics termina de procesar un día al siguiente: por defecto el rango
  // llega hasta ayer, para no comparar un día a medias contra días completos.
  const ayer = sumarDias(hoyEnChile(), -1);
  const sp = await searchParams;
  const hasta = sp.hasta && sp.hasta <= hoyEnChile() ? sp.hasta : ayer;
  const desde = sp.desde && sp.desde <= hasta ? sp.desde : sumarDias(hasta, -27);

  let d: DatosSitio;
  // La línea de hace un año y el mes a mes son extras: si fallan, la vista
  // sigue igual sin ellos.
  const inicioAnual = `${Number(ayer.slice(0, 4)) - 1}-01-01`;
  const visitas = conBase ? visitasDesdeBase : visitasPorDia;
  const [anio, anual] = await Promise.all([
    visitas(haceUnAnio(desde), haceUnAnio(hasta)).catch(() => null),
    visitas(inicioAnual, ayer).catch(() => null),
  ]);
  try {
    d = conBase ? await sitioDesdeBase(desde, hasta) : await datosSitio(desde, hasta);
  } catch (e) {
    return (
      <div className="pila">
        <Seccion titulo="Ahora mismo"><Ahora /></Seccion>
        <div className="aviso ojo"><b>No se pudo leer Analytics.</b> {explicarError(e)}</div>
      </div>
    );
  }

  const { actual: a, anterior: p } = d;
  const totalSesiones = d.canales.reduce((s, c) => s + c.sesiones, 0) || a.sesiones;

  // Primero las nuestras y después las heredadas, cada grupo de mayor a menor.
  const eventos: FilaBarra[] = [...d.eventos]
    .sort((x, y) => Number(y.nuestra) - Number(x.nuestra) || y.cantidad - x.cantidad)
    .map((e) => ({
      et: e.nombre,
      valor: e.cantidad,
      texto: numero(e.cantidad),
      detalle: e.nuestra ? undefined : "no se suma",
      color: e.nuestra ? "sitio" : "otro",
    }));
  const heredadas = d.conversionesAnalytics - a.conversiones;
  const meses = anual ? mesesDelAnio(anual, ayer) : null;
  const visitasAnio = anio ? anio.reduce((t, x) => t + x.valor, 0) : 0;
  const cambioAnio = visitasAnio > 0 ? (a.sesiones - visitasAnio) / visitasAnio : NaN;

  return (
    <div className="pila">
      <Seccion
        titulo="Ahora mismo"
        bajada="Quién está en el sitio en este momento. Se actualiza solo cada minuto, sin recargar la página."
      >
        <Ahora />
      </Seccion>

      <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
        <FiltroFechas desde={desde} hasta={hasta} min={conBase ? INICIO_BASE : INICIO_GA4} max={hoyEnChile()}
                      atajos={[7, 14, 28, 90]} conTodo={false} />
      </Suspense>

      <Seccion
        titulo="El sitio en el período"
        bajada={conBase
          ? "Salen de la base propia del panel, que trae Analytics cada mañana. Personas es la suma de cada día: quien entra tres días cuenta tres veces."
          : "Conectado a Analytics: estos números salen directo de la propiedad Valle del Sol, sin carga manual. Se refrescan cada hora."}
      >
        <div className="indicadores">
          <Kpi rotulo="Personas" familia="volumen" valor={numero(a.personas)}
               variacion={variacion(a.personas, p.personas)} />
          <Kpi rotulo="Visitas" familia="volumen" valor={numero(a.sesiones)}
               variacion={variacion(a.sesiones, p.sesiones)} />
          <Kpi rotulo="Interacción" familia="eficiencia" valor={porcentaje(tasa(a.interactivas, a.sesiones), 0)}
               variacion={variacion(tasa(a.interactivas, a.sesiones), tasa(p.interactivas, p.sesiones))}
               pie="visitas que no se fueron al tiro" />
          <Kpi rotulo="Conversiones" familia="volumen" valor={numero(a.conversiones)}
               variacion={variacion(a.conversiones, p.conversiones)}
               pie="solo las que configuramos" />
          <Kpi rotulo="Tasa de conversión" familia="eficiencia" valor={porcentaje(tasa(a.conversiones, a.sesiones), 1)}
               variacion={variacion(tasa(a.conversiones, a.sesiones), tasa(p.conversiones, p.sesiones))}
               pie="conversiones por cada visita" />
          <Kpi rotulo="Tiempo por visita" familia="eficiencia" valor={duracion(a.duracionMedia)}
               variacion={variacion(a.duracionMedia, p.duracionMedia)} />
        </div>
      </Seccion>

      <Seccion
        titulo="Día a día"
        bajada={
          anio
            ? "Visitas y conversiones separadas, cada una con su propia escala. En visitas, la línea gris punteada son los mismos días de la semana hace un año. Las conversiones no se comparan: las que configuramos existen recién desde septiembre."
            : "Visitas y conversiones separadas, cada una con su propia escala."
        }
      >
        <ParDeGraficos
          a={
            <Tarjeta titulo="Visitas por día"
                     extra={anio && isFinite(cambioAnio)
                       ? `${cambioAnio >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(cambioAnio * 100))} % vs. hace un año`
                       : "sesiones"}>
              <LineaDia datos={d.dias.map((x) => ({ fecha: x.fecha, valor: x.sesiones }))}
                        comparar={anio ?? undefined}
                        color="sitio" formato="numero" />
            </Tarjeta>
          }
          b={
            <Tarjeta titulo="Conversiones por día" extra="eventos clave">
              <LineaDia datos={d.dias.map((x) => ({ fecha: x.fecha, valor: x.conversiones }))}
                        color="otro" formato="numero" />
            </Tarjeta>
          }
        />
      </Seccion>

      {meses ? (
        <Seccion
          titulo={`Visitas mes a mes: ${meses.anio} contra ${meses.anio - 1}`}
          bajada={`Gris es ${meses.anio - 1}; verde, ${meses.anio}. El mes en curso se compara contra los mismos días del año pasado. No cambia con el filtro de fechas.`}
        >
          <Tarjeta nota={notaMeses(meses)}>
            <MesesAnio {...meses} color="sitio" formato="numero" />
          </Tarjeta>
        </Seccion>
      ) : null}

      <Seccion
        titulo="Qué conversiones hubo"
        bajada="Cada acción que marcamos como importante en el sitio, con su nombre en castellano."
      >
        <Tarjeta
          nota={
            heredadas > 0
              ? `Las barras violetas no son conversiones: son visitas a páginas que Analytics marca como «evento clave» por una configuración antigua. Analytics suma ${numero(d.conversionesAnalytics)} en el período; el panel cuenta solo las ${numero(a.conversiones)} reales y deja fuera esas ${numero(heredadas)}. Desmarcarlas en Analytics es una decisión aparte, porque Google Ads podría estar usando alguna.`
              : "Todas las conversiones del período son de los eventos que configuramos nosotros."
          }
        >
          {eventos.length ? <BarrasH filas={eventos} /> : <p className="nota" style={{ marginTop: 0 }}>Sin conversiones en el período.</p>}
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="De dónde vienen las visitas que convierten"
        bajada="No basta con que llegue gente: la tasa de conversión dice qué canal trae gente que de verdad pide algo."
      >
        <div className="tabla-marco">
          <table style={{ minWidth: 620 }}>
            <thead>
              <tr><th>Canal</th><th>Visitas</th><th>Parte</th><th>Conversiones</th><th>Tasa de conversión</th></tr>
            </thead>
            <tbody>
              {d.canales.map((c) => (
                <tr key={c.nombre}>
                  <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                  <td className="n" style={{ background: tinte(c.sesiones / totalSesiones) }}>{numero(c.sesiones)}</td>
                  <td className="n">{porcentaje(c.sesiones / totalSesiones, 0)}</td>
                  <td className="n">{numero(c.conversiones)}</td>
                  <td className="n">{porcentaje(tasa(c.conversiones, c.sesiones), 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <div className="rejilla dos">
        <Tarjeta titulo="Fuente exacta" extra="visitas · conversiones">
          <BarrasH color="sitio" filas={d.fuentes.map((f) => ({
            et: f.nombre, valor: f.sesiones, texto: numero(f.sesiones), detalle: `${numero(f.conversiones)} conv.`,
          }))} />
        </Tarjeta>
        <Tarjeta titulo="Página por la que entran" extra="visitas · conversiones">
          <BarrasH color="sitio" filas={d.entradas.map((f) => ({
            et: f.pagina, valor: f.sesiones, texto: numero(f.sesiones), detalle: `${numero(f.conversiones)} conv.`,
          }))} />
        </Tarjeta>
      </div>

      <p className="pie-pagina">
        Período: {fechaLarga(desde)} – {fechaLarga(hasta)}. Fuente: Google Analytics, propiedad Valle del Sol.
        Analytics termina de procesar cada día al siguiente, por eso el rango por defecto llega hasta ayer.
      </p>
    </div>
  );
}

function SinConectar() {
  return (
    <div className="pila">
      <div className="aviso ojo">
        <b>Analytics todavía no está conectado.</b> Falta la variable <code>GA4_CREDENCIALES</code> en
        Vercel, con el contenido del archivo JSON de la cuenta de servicio. Cuando esté, esta vista muestra
        quién está en el sitio ahora mismo, las conversiones por tipo y por canal, y el día a día.
      </div>
    </div>
  );
}

/** Lo que va del año contra el mismo tramo del año anterior. */
function notaMeses(m: ReturnType<typeof mesesDelAnio>) {
  const hoy = m.actual.reduce<number>((t, v) => t + (v ?? 0), 0);
  const antes = m.anterior.slice(0, m.mesEnCurso + 1).reduce((t, v) => t + v, 0);
  if (!antes) return undefined;
  const v = (hoy - antes) / antes;
  return `En lo que va de ${m.anio} el sitio lleva ${numero(hoy)} visitas; a la misma fecha de ${m.anio - 1} llevaba ${numero(antes)} (${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} %).`;
}
