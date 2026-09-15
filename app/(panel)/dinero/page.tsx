import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import { BarrasDia, LineaDia, ParDeGraficos } from "../../../components/graficos";
import { Kpi, Var, Seccion, Tarjeta, ChipCanal, Leyenda } from "../../../components/ui";
import { RANGO_DATOS, SUPUESTOS } from "../../../lib/datos";
import {
  enRango, resumir, periodoAnterior, variacion, serieDiaria, porCampana, porCanal,
  plata, numero, porcentaje, veces, sumarDias, fechaLarga, NOMBRE_CANAL,
} from "../../../lib/calculos";

export const dynamic = "force-dynamic";

const POR_DEFECTO = {
  desde: sumarDias(RANGO_DATOS.hasta, -13),
  hasta: RANGO_DATOS.hasta,
};

export default async function Dinero({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const desde = sp.desde ?? POR_DEFECTO.desde;
  const hasta = sp.hasta ?? POR_DEFECTO.hasta;

  const filas = enRango(desde, hasta);
  const hoy = resumir(filas);

  const previo = periodoAnterior(desde, hasta);
  const antes = resumir(enRango(previo.desde, previo.hasta));

  const gastoDia = serieDiaria(filas, desde, hasta, "inversion");
  const imprDia = serieDiaria(filas, desde, hasta, "impresiones");
  const clicsDia = serieDiaria(filas, desde, hasta, "clics");

  const campanas = porCampana(filas);
  const campanasAntes = new Map(
    porCampana(enRango(previo.desde, previo.hasta)).map((c) => [c.campana, c])
  );
  const canales = porCanal(filas);

  const conviene = isFinite(hoy.cac) && hoy.cac <= hoy.comisionOta;

  return (
    <div className="pila">
      <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
        <FiltroFechas desde={desde} hasta={hasta} />
      </Suspense>

      <Seccion
        titulo="Los números del período"
        bajada="Todos medidos, ninguno estimado. La flecha compara contra el período anterior del mismo largo. En los costos, la flecha hacia abajo es buena noticia."
      >
        <div className="indicadores">
          <Kpi rotulo="Inversión" familia="costo" valor={plata(hoy.inversion)}
               variacion={variacion(hoy.inversion, antes.inversion)} />
          <Kpi rotulo="Impresiones" familia="volumen" valor={numero(hoy.impresiones)}
               variacion={variacion(hoy.impresiones, antes.impresiones)} />
          <Kpi rotulo="Clics" familia="volumen" valor={numero(hoy.clics)}
               variacion={variacion(hoy.clics, antes.clics)} />
          <Kpi rotulo="CTR" familia="eficiencia" valor={porcentaje(hoy.ctr)}
               variacion={variacion(hoy.ctr, antes.ctr)} />
          <Kpi rotulo="Leads" familia="volumen" valor={numero(hoy.leads)}
               variacion={variacion(hoy.leads, antes.leads)}
               pie="cotizaciones y conversaciones" />
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
        bajada="Ordenadas por lo que gastaron. La columna Δ compara cada campaña contra el período anterior."
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
                    <td><Var v={a ? variacion(c.inversion, a.inversion) : null} /></td>
                    <td className="n">{numero(c.impresiones)}</td>
                    <td className="n">{numero(c.clics)}</td>
                    <td><Var v={a ? variacion(c.clics, a.clics) : null} /></td>
                    <td className="n">{porcentaje(c.ctr)}</td>
                    <td className="n">{plata(c.cpc)}</td>
                    <td className="n">{numero(c.leads)}</td>
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
                <td><Var v={variacion(hoy.inversion, antes.inversion)} /></td>
                <td className="n">{numero(hoy.impresiones)}</td>
                <td className="n">{numero(hoy.clics)}</td>
                <td><Var v={variacion(hoy.clics, antes.clics)} /></td>
                <td className="n">{porcentaje(hoy.ctr)}</td>
                <td className="n">{plata(hoy.cpc)}</td>
                <td className="n">{numero(hoy.leads)}</td>
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
        Período mostrado: {fechaLarga(desde)} – {fechaLarga(hasta)}. Datos cargados a mano el{" "}
        {fechaLarga(RANGO_DATOS.hasta)} desde Meta y Google Ads. Las campañas de Google partieron el 14 de
        septiembre, por eso casi todo el historial largo es solo de Meta.
      </p>
    </div>
  );
}

/** Tiñe la celda según su peso dentro del total, como en la tabla de
 *  referencia. Máximo 22 % de opacidad para no tapar el número. */
function tinte(parte: number, rgb: string) {
  return `rgba(${rgb}, ${(Math.min(1, Math.max(0, parte)) * 0.22).toFixed(3)})`;
}
