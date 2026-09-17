import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import { BarrasDia, LineaDia, MesesAnio, ParDeGraficos, COLOR_ANTERIOR } from "../../../components/graficos";
import { Kpi, Var, Seccion, Tarjeta, ChipCanal, Leyenda } from "../../../components/ui";
import { RANGO_DATOS, ULTIMO_DIA_META, type DiaCampana } from "../../../lib/datos";
import {
  enRango, resumir, periodoAnterior, variacion, variacionNeutra, serieDiaria, porCampana, porCanal,
  plata, numero, porcentaje, sumarDias, fechaLarga, hoyEnChile, NOMBRE_CANAL, haceUnAnio, mesesDelAnio,
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

export default async function Conversiones({
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
  // Para el mes a mes: desde el 1 de enero del año pasado hasta el último día
  // cerrado. Queda en caché una hora, igual que el resto.
  const tope12 = conectado ? sumarDias(hoyEnChile(), -1) : RANGO_DATOS.hasta;
  const inicioAnual = `${Number(tope12.slice(0, 4)) - 1}-01-01`;
  const [ahora, antesDe, haceAnio, anual] = await Promise.all([
    filasDelPeriodo(desde, hasta),
    filasDelPeriodo(previo.desde, previo.hasta),
    filasDelPeriodo(haceUnAnio(desde), haceUnAnio(hasta)),
    conectado ? filasDelPeriodo(inicioAnual, tope12) : null,
  ]);
  const filas = ahora.filas;
  const hoy = resumir(filas);
  const antes = resumir(antesDe.filas);
  const metaIncompleto = !ahora.metaEnVivo && conectado && hasta > ULTIMO_DIA_META;

  const gastoDia = serieDiaria(filas, desde, hasta, "inversion");
  const imprDia = serieDiaria(filas, desde, hasta, "impresiones");
  const clicsDia = serieDiaria(filas, desde, hasta, "clics");
  const imprAnio = serieDiaria(haceAnio.filas, haceUnAnio(desde), haceUnAnio(hasta), "impresiones");
  const clicsAnio = serieDiaria(haceAnio.filas, haceUnAnio(desde), haceUnAnio(hasta), "clics");
  const hayAnio = haceAnio.filas.length > 0;
  const total = (xs: Array<{ total: number }>) => xs.reduce((a, d) => a + d.total, 0);

  const mensual = (campo: "inversion" | "impresiones" | "clics") =>
    anual
      ? mesesDelAnio(
          serieDiaria(anual.filas, inicioAnual, tope12, campo).map((d) => ({ fecha: d.fecha, valor: d.total })),
          tope12,
        )
      : null;
  const gastoMes = mensual("inversion");
  const imprMes = mensual("impresiones");
  const clicsMes = mensual("clics");

  const campanas = porCampana(filas);
  const campanasAntes = new Map(porCampana(antesDe.filas).map((c) => [c.campana, c]));
  const canales = porCanal(filas);

  return (
    <div className="pila">
      <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
        <FiltroFechas desde={desde} hasta={hasta} min={conectado ? "2025-01-01" : RANGO_DATOS.desde}
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
        bajada={
          hayAnio
            ? "La línea oscura es este período; la gris punteada, los mismos días de la semana hace un año. Impresiones y clics van en gráficos separados porque tienen tamaños muy distintos."
            : "Van en dos gráficos separados a propósito: impresiones y clics tienen tamaños muy distintos, y juntarlos obliga a usar dos escalas en un mismo dibujo."
        }
      >
        <ParDeGraficos
          a={
            <Tarjeta titulo="Impresiones por día" extra={hayAnio ? varAnio(total(imprDia), total(imprAnio)) : "cuántas veces se mostró"}>
              <LineaDia datos={imprDia.map((d) => ({ fecha: d.fecha, valor: d.total }))}
                        comparar={hayAnio ? imprAnio.map((d) => ({ fecha: d.fecha, valor: d.total })) : undefined}
                        color="total" formato="numero" />
            </Tarjeta>
          }
          b={
            <Tarjeta titulo="Clics por día" extra={hayAnio ? varAnio(total(clicsDia), total(clicsAnio)) : "cuántas veces lo apretaron"}>
              <LineaDia datos={clicsDia.map((d) => ({ fecha: d.fecha, valor: d.total }))}
                        comparar={hayAnio ? clicsAnio.map((d) => ({ fecha: d.fecha, valor: d.total })) : undefined}
                        color="total" formato="numero" />
            </Tarjeta>
          }
        />
        {hayAnio ? (
          <div style={{ marginTop: 12 }}>
            <Leyenda items={[["Este período", "var(--tinta)"], ["Hace un año", COLOR_ANTERIOR]]} />
          </div>
        ) : null}
      </Seccion>

      {gastoMes && imprMes && clicsMes ? (
        <Seccion
          titulo={`Mes a mes: ${imprMes.anio} contra ${imprMes.anio - 1}`}
          bajada={`Google Ads y Meta sumados. Gris es ${imprMes.anio - 1}; oscuro, ${imprMes.anio}. El mes en curso se compara contra los mismos días del año pasado, para no poner un mes a medias contra uno completo. No cambia con el filtro de fechas.`}
        >
          {/* Uno debajo del otro: doce meses con dos barras cada uno necesitan
              el ancho completo para leerse. */}
          <div className="pila">
            <Tarjeta titulo="Inversión total en publicidad por mes" extra="Google Ads + Meta"
                     nota={notaMeses(gastoMes, "invertidos", plata)}>
              <MesesAnio {...gastoMes} color="total" formato="plata" />
            </Tarjeta>
            <Tarjeta titulo="Impresiones por mes" nota={notaMeses(imprMes, "impresiones")}>
              <MesesAnio {...imprMes} color="total" formato="numero" />
            </Tarjeta>
            <Tarjeta titulo="Clics por mes" nota={notaMeses(clicsMes, "clics")}>
              <MesesAnio {...clicsMes} color="total" formato="numero" />
            </Tarjeta>
          </div>
          <div style={{ marginTop: 12 }}>
            <Leyenda items={[[String(imprMes.anio), "var(--tinta)"], [String(imprMes.anio - 1), COLOR_ANTERIOR]]} />
          </div>
        </Seccion>
      ) : null}

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

/** Lo que va del año contra el mismo tramo del año anterior. */
function notaMeses(m: ReturnType<typeof mesesDelAnio>, que: string, formato: (v: number) => string = numero) {
  const hoy = m.actual.reduce<number>((t, v) => t + (v ?? 0), 0);
  const antes = m.anterior.slice(0, m.mesEnCurso + 1).reduce((t, v) => t + v, 0);
  if (!antes) return undefined;
  const v = (hoy - antes) / antes;
  return `En lo que va de ${m.anio} van ${formato(hoy)} ${que}; a la misma fecha de ${m.anio - 1} iban ${formato(antes)} (${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} %).`;
}

/** «▲ 12 % vs. hace un año», para la esquina de la tarjeta. */
function varAnio(actual: number, anterior: number) {
  if (!anterior) return "sin datos hace un año";
  const v = (actual - anterior) / anterior;
  return `${v >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(v * 100))} % vs. hace un año`;
}

/** Tiñe la celda según su peso dentro del total, como en la tabla de
 *  referencia. Máximo 22 % de opacidad para no tapar el número. */
function tinte(parte: number, rgb: string) {
  return `rgba(${rgb}, ${(Math.min(1, Math.max(0, parte)) * 0.22).toFixed(3)})`;
}
