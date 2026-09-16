import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import { BarrasDia, LineaDia, ParDeGraficos } from "../../../components/graficos";
import { Kpi, Var, Seccion, Tarjeta, ChipCanal, Leyenda } from "../../../components/ui";
import { RANGO_DATOS, SUPUESTOS, ULTIMO_DIA_META, type DiaCampana } from "../../../lib/datos";
import {
  enRango, resumir, periodoAnterior, variacion, variacionNeutra, serieDiaria, porCampana, porCanal,
  plata, numero, porcentaje, veces, sumarDias, fechaLarga, hoyEnChile, NOMBRE_CANAL,
} from "../../../lib/calculos";
import { ga4Conectado, googleAdsDias, explicarError } from "../../../lib/ga4";
import { metaConectado, metaDias, explicarErrorMeta } from "../../../lib/meta";

export const dynamic = "force-dynamic";

/** Meta se lee de su API y Google Ads desde Analytics. Si alguna no está
 *  conectada o no responde, esa parte vuelve a la carga manual y se avisa. */
async function filasDelPeriodo(desde: string, hasta: string) {
  const manual = enRango(desde, hasta);

  const meta = metaConectado()
    ? metaDias(desde, hasta).then(
        (filas) => ({ filas, enVivo: true, error: null as string | null }),
        (e) => ({ filas: manual.filter((f) => f.canal === "meta"), enVivo: false, error: explicarErrorMeta(e) }),
      )
    : Promise.resolve({ filas: manual.filter((f) => f.canal === "meta"), enVivo: false, error: null });

  const google = ga4Conectado()
    ? googleAdsDias(desde, hasta).then(
        (filas: DiaCampana[]) => ({ filas, enVivo: true, error: null as string | null }),
        (e) => ({ filas: manual.filter((f) => f.canal === "google"), enVivo: false, error: explicarError(e) }),
      )
    : Promise.resolve({ filas: manual.filter((f) => f.canal === "google"), enVivo: false, error: null });

  const [m, g] = await Promise.all([meta, google]);
  return {
    filas: [...m.filas, ...g.filas],
    metaEnVivo: m.enVivo,
    googleEnVivo: g.enVivo,
    errorMeta: m.error,
    errorGoogle: g.error,
  };
}

export default async function Dinero({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  // Con alguna fuente en vivo el período llega hasta ayer (el día de hoy aún
  // no cierra); sin conexión, hasta el último día cargado a mano.
  const conectado = ga4Conectado() || metaConectado();
  const tope = conectado ? sumarDias(hoyEnChile(), -1) : RANGO_DATOS.hasta;
  const sp = await searchParams;
  const hasta = sp.hasta && sp.hasta <= hoyEnChile() ? sp.hasta : tope;
  const desde = sp.desde && sp.desde <= hasta ? sp.desde : sumarDias(hasta, -13);

  const previo = periodoAnterior(desde, hasta);
  const [ahora, antesDe] = await Promise.all([
    filasDelPeriodo(desde, hasta),
    filasDelPeriodo(previo.desde, previo.hasta),
  ]);
  const filas = ahora.filas;
  const hoy = resumir(filas);
  const antes = resumir(antesDe.filas);
  const metaIncompleto = !ahora.metaEnVivo && conectado && hasta > ULTIMO_DIA_META;
  // Las conversaciones de Paseos o Matrimonios entran al retorno con el cierre
  // de eventos, que está medido sobre cotizaciones y no sobre conversaciones.
  const conversacionesEventosMeta = filas
    .filter((f) => f.canal === "meta" && !/caba/i.test(f.campana))
    .reduce((a, f) => a + (f.leads ?? 0), 0);

  const gastoDia = serieDiaria(filas, desde, hasta, "inversion");
  const imprDia = serieDiaria(filas, desde, hasta, "impresiones");
  const clicsDia = serieDiaria(filas, desde, hasta, "clics");

  const campanas = porCampana(filas);
  const campanasAntes = new Map(porCampana(antesDe.filas).map((c) => [c.campana, c]));
  const canales = porCanal(filas);

  const conviene = isFinite(hoy.cac) && hoy.cac <= hoy.comisionOta;

  return (
    <div className="pila">
      <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
        <FiltroFechas desde={desde} hasta={hasta} min={conectado ? "2026-01-01" : RANGO_DATOS.desde}
                      max={conectado ? hoyEnChile() : RANGO_DATOS.hasta} />
      </Suspense>

      {ahora.errorMeta ? (
        <div className="aviso ojo">
          <b>Meta no se pudo leer en vivo; se muestra la carga manual.</b> {ahora.errorMeta}
        </div>
      ) : null}

      {ahora.errorGoogle ? (
        <div className="aviso ojo">
          <b>Google Ads no se pudo leer en vivo; se muestra la carga manual.</b> {ahora.errorGoogle}
        </div>
      ) : null}

      {metaIncompleto ? (
        <div className="aviso info">
          <b>Meta está cargado a mano y llega solo hasta el {fechaLarga(ULTIMO_DIA_META)}.</b> Después de esa
          fecha no hay datos de Meta en este período (no significa que haya gastado cero), así que los totales y
          la comparación contra el período anterior quedan cortos.
        </div>
      ) : null}

      <Seccion
        titulo="Los números del período"
        bajada="Todos medidos, ninguno estimado. La flecha compara contra el período anterior del mismo largo. En los costos, la flecha hacia abajo es buena noticia."
      >
        <div className="indicadores">
          <Kpi rotulo="Inversión" familia="costo" valor={plata(hoy.inversion)}
               variacion={variacionNeutra(hoy.inversion, antes.inversion)} />
          <Kpi rotulo="Impresiones" familia="volumen" valor={numero(hoy.impresiones)}
               variacion={variacion(hoy.impresiones, antes.impresiones)} />
          <Kpi rotulo="Clics" familia="volumen" valor={numero(hoy.clics)}
               variacion={variacion(hoy.clics, antes.clics)} />
          <Kpi rotulo="CTR" familia="eficiencia" valor={porcentaje(hoy.ctr)}
               variacion={variacion(hoy.ctr, antes.ctr)} />
          <Kpi rotulo="Leads" familia="volumen" valor={numero(hoy.leads)}
               variacion={variacion(hoy.leads, antes.leads)}
               pie="contactos reales" />
          <Kpi rotulo="Costo por lead" familia="costo" valor={plata(hoy.cpl)}
               variacion={variacion(hoy.cpl, antes.cpl, true)} />
        </div>
      </Seccion>

      <Seccion
        titulo="Inversión día a día"
        bajada="Cada barra es un día. El naranja es Meta y el azul es Google. Pasa el cursor por encima para ver el detalle."
      >
        <Tarjeta>
          <BarrasDia datos={gastoDia} formato="plata" />
          <div style={{ marginTop: 12 }}>
            <Leyenda items={[["Google Ads", "var(--google)"], ["Meta", "var(--meta)"]]} />
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="Cuánta gente vio y cuánta entró"
        bajada="Van en dos gráficos separados a propósito. Ponerlos juntos obliga a usar dos escalas distintas en un mismo dibujo, y eso hace que dos líneas se vean pegadas aunque no tengan ninguna relación."
      >
        <ParDeGraficos
          a={
            <Tarjeta titulo="Impresiones por día" extra="cuántas veces se mostró">
              <LineaDia datos={imprDia.map((d) => ({ fecha: d.fecha, valor: d.total }))}
                        color="google" formato="numero" />
            </Tarjeta>
          }
          b={
            <Tarjeta titulo="Clics por día" extra="cuántas veces lo apretaron">
              <LineaDia datos={clicsDia.map((d) => ({ fecha: d.fecha, valor: d.total }))}
                        color="meta" formato="numero" />
            </Tarjeta>
          }
        />
      </Seccion>

      <Seccion
        titulo="Campaña por campaña"
        bajada="Ordenadas por lo que gastaron. Δ compara contra el período anterior. Lead en Meta es una conversación de WhatsApp iniciada; en Google, una cotización enviada, una reserva pagada o un WhatsApp. Intención son los clics en «Cotizar» o «Reservar»: interés, pero la persona todavía no escribió."
      >
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Canal</th>
                <th>Inversión</th>
                <th>Δ</th>
                <th>Impresiones</th>
                <th>Clics</th>
                <th>Δ</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>Leads</th>
                <th>Intención</th>
                <th>Costo por lead</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {campanas.map((c) => {
                const a = campanasAntes.get(c.campana);
                const parte = hoy.inversion > 0 ? c.inversion / hoy.inversion : 0;
                return (
                  <tr key={c.campana}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{c.campana}</span>
                      <div style={{ fontSize: 11.5, color: "var(--tinta3)" }}>
                        {porcentaje(parte, 0)} del gasto
                      </div>
                    </td>
                    <td style={{ textAlign: "left" }}><ChipCanal canal={c.canal} /></td>
                    <td className="n" style={{ background: tinte(parte, "29,78,216") }}>
                      {plata(c.inversion)}
                    </td>
                    <td><Var v={a ? variacionNeutra(c.inversion, a.inversion) : null} /></td>
                    <td className="n">{numero(c.impresiones)}</td>
                    <td className="n">{numero(c.clics)}</td>
                    <td><Var v={a ? variacion(c.clics, a.clics) : null} /></td>
                    <td className="n">{porcentaje(c.ctr)}</td>
                    <td className="n">{plata(c.cpc)}</td>
                    <td className="n">{numero(c.leads)}</td>
                    <td className="n">{c.canal === "google" ? numero(c.intenciones) : "—"}</td>
                    <td className="n">{plata(c.cpl)}</td>
                    <td><Var v={a ? variacion(c.cpl, a.cpl, true) : null} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td></td>
                <td className="n">{plata(hoy.inversion)}</td>
                <td><Var v={variacionNeutra(hoy.inversion, antes.inversion)} /></td>
                <td className="n">{numero(hoy.impresiones)}</td>
                <td className="n">{numero(hoy.clics)}</td>
                <td><Var v={variacion(hoy.clics, antes.clics)} /></td>
                <td className="n">{porcentaje(hoy.ctr)}</td>
                <td className="n">{plata(hoy.cpc)}</td>
                <td className="n">{numero(hoy.leads)}</td>
                <td className="n">{numero(hoy.intenciones)}</td>
                <td className="n">{plata(hoy.cpl)}</td>
                <td><Var v={variacion(hoy.cpl, antes.cpl, true)} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Seccion>

      <Seccion
        titulo="Cómo se reparte entre canales"
        bajada="Google recoge a quien ya está buscando. Meta le pone la idea adelante a quien no estaba buscando. Se miden igual pero no compiten."
      >
        <div className="rejilla dos">
          {canales.map((c) => (
            <Tarjeta key={c.canal} titulo={NOMBRE_CANAL[c.canal]}
                     extra={porcentaje(hoy.inversion > 0 ? c.inversion / hoy.inversion : 0, 0) + " del gasto"}>
              <div className="barras">
                {[
                  ["Inversión", plata(c.inversion)],
                  ["Impresiones", numero(c.impresiones)],
                  ["Clics", numero(c.clics)],
                  ["CTR", porcentaje(c.ctr)],
                  ["CPC", plata(c.cpc)],
                  ["Leads", numero(c.leads)],
                  ...(c.canal === "google" ? [["Intención", numero(c.intenciones)]] : []),
                  ["Costo por lead", plata(c.cpl)],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    padding: "6px 0", borderBottom: "1px dotted var(--borde)", fontSize: 13,
                  }}>
                    <span style={{ color: "var(--tinta2)" }}>{k}</span>
                    <b style={{ fontFamily: "var(--mono)" }}>{v}</b>
                  </div>
                ))}
              </div>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      <Seccion
        titulo="Retorno estimado"
        bajada="Esta es la única parte del panel que no es un hecho medido. Sale de multiplicar los leads por una tasa de cierre y un ticket promedio."
      >
        <div className="aviso ojo" style={{ marginBottom: 14 }}>
          <b>Léelo con pinzas.</b> El cierre de eventos ({Math.round(SUPUESTOS.eventos.cierre * 100)} % sobre
          un ticket de {plata(SUPUESTOS.eventos.ticket)}) está medido en Eventia. El de cabañas
          ({Math.round(SUPUESTOS.cabanas.cierre * 100)} % sobre {plata(SUPUESTOS.cabanas.ticket)}) es un punto
          de partida sin confirmar: no sabemos cuántas conversaciones de WhatsApp terminan en una estadía real.
          Hasta que conectemos Eventia, este número sirve para comparar semanas entre sí, no para decir
          cuánta plata entró.
          {conversacionesEventosMeta > 0 ? (
            <>
              {" "}Además, {numero(conversacionesEventosMeta)} conversaciones de WhatsApp de las campañas de eventos
              de Meta entran con el cierre de eventos, que está medido sobre cotizaciones y no sobre
              conversaciones: por ese lado el ingreso estimado sale inflado.
            </>
          ) : null}
        </div>
        <div className="rejilla tres">
          <Tarjeta titulo="Si los supuestos fueran ciertos">
            <div className="barras">
              {[
                ["Leads del período", numero(hoy.leads)],
                ["Cierres estimados", numero(hoy.cierres)],
                ["Ingreso estimado", plata(hoy.ingreso)],
                ["Invertido", plata(hoy.inversion)],
                ["Diferencia", plata(hoy.ingreso - hoy.inversion)],
                ["Roas", veces(hoy.roas)],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "6px 0", borderBottom: "1px dotted var(--borde)", fontSize: 13,
                }}>
                  <span style={{ color: "var(--tinta2)" }}>{k}</span>
                  <b style={{ fontFamily: "var(--mono)" }}>{v}</b>
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Contra la comisión de Booking"
                   nota="Booking se lleva el 15 % de cada reserva. Si conseguir un cliente por publicidad cuesta menos que esa comisión, conviene la pauta. Si cuesta más, conviene pagarle a Booking.">
            <div className="barras">
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--tinta2)" }}>Costo por cliente (CAC)</span>
                <b style={{ fontFamily: "var(--mono)" }}>{plata(hoy.cac)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--tinta2)" }}>Comisión de Booking</span>
                <b style={{ fontFamily: "var(--mono)" }}>{plata(hoy.comisionOta)}</b>
              </div>
              <div style={{ marginTop: 10 }}>
                <span className={`marca-estado ${conviene ? "bien" : "falta"}`}>
                  {isFinite(hoy.cac) ? (conviene ? "Conviene la pauta" : "Conviene Booking") : "Sin leads en el período"}
                </span>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Lo que falta para que sea un hecho"
                   nota="Cuando Eventia entregue las cotizaciones reales, este bloque deja de ser una estimación y pasa a ser plata contada.">
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta2)" }}>
              Eventia ya guarda de dónde llegó cada lead, el monto de cada cotización y si se cerró o se perdió.
              Con eso el retorno se calcula con los números de verdad y estos supuestos se borran.
            </p>
          </Tarjeta>
        </div>
      </Seccion>

      <p className="pie-pagina">
        Período mostrado: {fechaLarga(desde)} – {fechaLarga(hasta)}.{" "}
        {ahora.metaEnVivo
          ? "Meta en vivo desde su API, refrescado cada hora."
          : `Meta cargado a mano hasta el ${fechaLarga(ULTIMO_DIA_META)}.`}{" "}
        {ahora.googleEnVivo
          ? "Google Ads en vivo desde Analytics, refrescado cada hora."
          : "Google Ads cargado a mano."}{" "}
        Las campañas actuales de Google partieron el 14 de septiembre.
      </p>
    </div>
  );
}

/** Tiñe la celda según su peso dentro del total, como en la tabla de
 *  referencia. Máximo 22 % de opacidad para no tapar el número. */
function tinte(parte: number, rgb: string) {
  return `rgba(${rgb}, ${(Math.min(1, Math.max(0, parte)) * 0.22).toFixed(3)})`;
}
