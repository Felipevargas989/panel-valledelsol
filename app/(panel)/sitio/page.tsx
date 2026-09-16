import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import Ahora from "../../../components/Ahora";
import { BarrasH, LineaDia, ParDeGraficos, type FilaBarra } from "../../../components/graficos";
import { Kpi, Seccion, Tarjeta } from "../../../components/ui";
import { datosSitio, ga4Conectado, explicarError, EVENTOS, type DatosSitio } from "../../../lib/ga4";
import {
  variacion, numero, porcentaje, sumarDias, fechaLarga, hoyEnChile, duracionTexto as duracion,
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
  if (!ga4Conectado()) return <SinConectar />;

  // Analytics termina de procesar un día al siguiente: por defecto el rango
  // llega hasta ayer, para no comparar un día a medias contra días completos.
  const ayer = sumarDias(hoyEnChile(), -1);
  const sp = await searchParams;
  const hasta = sp.hasta && sp.hasta <= hoyEnChile() ? sp.hasta : ayer;
  const desde = sp.desde && sp.desde <= hasta ? sp.desde : sumarDias(hasta, -27);

  let d: DatosSitio;
  try {
    d = await datosSitio(desde, hasta);
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

  const eventos: FilaBarra[] = d.eventos.map((e) => ({
    et: e.nombre,
    valor: e.cantidad,
    texto: numero(e.cantidad),
    color: e.clave in EVENTOS ? "sitio" : "otro",
  }));
  const hayAjenos = d.eventos.some((e) => !(e.clave in EVENTOS));

  return (
    <div className="pila">
      <Seccion
        titulo="Ahora mismo"
        bajada="Quién está en el sitio en este momento. Se actualiza solo cada minuto, sin recargar la página."
      >
        <Ahora />
      </Seccion>

      <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
        <FiltroFechas desde={desde} hasta={hasta} min={INICIO_GA4} max={hoyEnChile()}
                      atajos={[7, 14, 28, 90]} conTodo={false} />
      </Suspense>

      <Seccion
        titulo="El sitio en el período"
        bajada="Conectado a Analytics: estos números salen directo de la propiedad Valle del Sol, sin carga manual. Se refrescan cada hora."
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
               variacion={variacion(a.conversiones, p.conversiones)} />
          <Kpi rotulo="Tasa de conversión" familia="eficiencia" valor={porcentaje(tasa(a.conversiones, a.sesiones), 1)}
               variacion={variacion(tasa(a.conversiones, a.sesiones), tasa(p.conversiones, p.sesiones))}
               pie="conversiones por cada visita" />
          <Kpi rotulo="Tiempo por visita" familia="eficiencia" valor={duracion(a.duracionMedia)}
               variacion={variacion(a.duracionMedia, p.duracionMedia)} />
        </div>
      </Seccion>

      <Seccion titulo="Día a día" bajada="Visitas y conversiones separadas, cada una con su propia escala.">
        <ParDeGraficos
          a={
            <Tarjeta titulo="Visitas por día" extra="sesiones">
              <LineaDia datos={d.dias.map((x) => ({ fecha: x.fecha, valor: x.sesiones }))}
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

      <Seccion
        titulo="Qué conversiones hubo"
        bajada="Cada acción que marcamos como importante en el sitio, con su nombre en castellano."
      >
        <Tarjeta
          nota={
            hayAjenos
              ? "Las barras violetas son eventos que no configuramos nosotros: vienen de mediciones antiguas y inflan el total de conversiones. Conviene desmarcarlos como evento clave en Analytics."
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
