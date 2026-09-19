import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import { BarrasDia, LineaDia, MesesAnio, ParDeGraficos } from "../../../components/graficos";
import { Kpi, Var, Seccion, Tarjeta, ChipCanal } from "../../../components/ui";
import { RANGO_DATOS, ULTIMO_DIA_META, type DiaCampana } from "../../../lib/datos";
import {
  enRango, resumir, periodoAnterior, variacion, variacionNeutra, serieDiaria, porCampana, porCanal,
  plata, numero, porcentaje, sumarDias, fechaLarga, hoyEnChile, NOMBRE_CANAL, haceUnAnio, mesesDelAnio,
} from "../../../lib/calculos";
import { ga4Conectado, googleAdsDias, explicarError } from "../../../lib/ga4";
import { metaConectado, metaDias, metaTotalesDia, explicarErrorMeta } from "../../../lib/meta";
import { baseConectada, leerCampanaDia, serieCampanasDesdeBase, ultimoDiaGuardado, INICIO_BASE } from "../../../lib/base";

export const dynamic = "force-dynamic";
// La comparación anual pide año y medio a dos fuentes: 10 segundos no alcanzan.
export const maxDuration = 30;

/** Meta se lee de su API y Google Ads desde Analytics. Si alguna no está
 *  conectada o no responde, esa parte vuelve a la carga manual y se avisa. */
async function filasDelPeriodo(desde: string, hasta: string) {
  // Con la base propia no se toca ninguna API: se lee lo que trajo la ingesta.
  if (baseConectada()) {
    const filas = await leerCampanaDia(desde, hasta);
    return { filas, metaEnVivo: true, googleEnVivo: true, errorMeta: null as string | null, errorGoogle: null as string | null };
  }
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

/** Para el mes a mes solo hacen falta los totales por día de cada canal.
 *  Cada fuente se pide aparte: si una falla, la otra igual se muestra y el
 *  panel lo dice, porque un gráfico con la mitad del gasto miente. */
async function serieAnual(desde: string, hasta: string) {
  if (baseConectada()) {
    const dias = await serieCampanasDesdeBase(desde, hasta);
    const serie = (campo: "inversion" | "impresiones" | "clics") => dias.map((d) => ({ fecha: d.fecha, valor: d[campo] }));
    return { serie, faltaMeta: false, faltaGoogle: false };
  }
  const [meta, google] = await Promise.all([
    metaConectado() ? metaTotalesDia(desde, hasta).catch(() => null) : Promise.resolve(null),
    ga4Conectado() ? googleAdsDias(desde, hasta).catch(() => null) : Promise.resolve(null),
  ]);
  if (!meta && !google) return null;

  const suma = new Map<string, { inversion: number; impresiones: number; clics: number }>();
  const anotar = (fecha: string, inversion: number, impresiones: number, clics: number) => {
    const x = suma.get(fecha) ?? { inversion: 0, impresiones: 0, clics: 0 };
    x.inversion += inversion; x.impresiones += impresiones; x.clics += clics;
    suma.set(fecha, x);
  };
  for (const d of meta ?? []) anotar(d.fecha, d.inversion, d.impresiones, d.clics);
  for (const d of google ?? []) anotar(d.fecha, d.inversion, d.impresiones, d.clics);

  const serie = (campo: "inversion" | "impresiones" | "clics") =>
    [...suma.entries()].map(([fecha, x]) => ({ fecha, valor: x[campo] })).sort((a, b) => a.fecha.localeCompare(b.fecha));

  return { serie, faltaMeta: metaConectado() && !meta, faltaGoogle: ga4Conectado() && !google };
}

export default async function Conversiones({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  // Con alguna fuente en vivo el período llega hasta ayer (el día de hoy aún
  // no cierra); sin conexión, hasta el último día cargado a mano.
  const conBase = baseConectada();
  const conectado = conBase || ga4Conectado() || metaConectado();
  const tope = conectado ? sumarDias(hoyEnChile(), -1) : RANGO_DATOS.hasta;
  const sp = await searchParams;
  const hasta = sp.hasta && sp.hasta <= hoyEnChile() ? sp.hasta : tope;
  const desde = sp.desde && sp.desde <= hasta ? sp.desde : sumarDias(hasta, -13);

  const previo = periodoAnterior(desde, hasta);
  // Para el mes a mes: desde el 1 de enero del año pasado hasta el último día
  // cerrado. Queda en caché una hora, igual que el resto.
  const tope12 = conectado ? sumarDias(hoyEnChile(), -1) : RANGO_DATOS.hasta;
  const inicioAnual = `${Number(tope12.slice(0, 4)) - 1}-01-01`;
  const [ahora, antesDe, haceAnio] = await Promise.all([
    filasDelPeriodo(desde, hasta),
    filasDelPeriodo(previo.desde, previo.hasta),
    filasDelPeriodo(haceUnAnio(desde), haceUnAnio(hasta)),
  ]);
  const filas = ahora.filas;
  const hoy = resumir(filas);
  const antes = resumir(antesDe.filas);
  const metaIncompleto = !conBase && !ahora.metaEnVivo && conectado && hasta > ULTIMO_DIA_META;
  const ultimoDia = conBase ? await ultimoDiaGuardado() : {};

  const gastoDia = serieDiaria(filas, desde, hasta, "inversion");
  const imprDia = serieDiaria(filas, desde, hasta, "impresiones");
  const clicsDia = serieDiaria(filas, desde, hasta, "clics");
  const imprAnio = serieDiaria(haceAnio.filas, haceUnAnio(desde), haceUnAnio(hasta), "impresiones");
  const clicsAnio = serieDiaria(haceAnio.filas, haceUnAnio(desde), haceUnAnio(hasta), "clics");
  const hayAnio = haceAnio.filas.length > 0;
  const total = (xs: Array<{ total: number }>) => xs.reduce((a, d) => a + d.total, 0);

  const campanas = porCampana(filas);
  const campanasAntes = new Map(porCampana(antesDe.filas).map((c) => [c.campana, c]));
  const canales = porCanal(filas);

  return (
    <div className="pila">
      <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
        <FiltroFechas desde={desde} hasta={hasta} min={conBase ? INICIO_BASE : conectado ? "2025-01-01" : RANGO_DATOS.desde}
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
        bajada="Todos medidos, ninguno estimado. La flecha compara contra el período anterior del mismo largo; en los costos, hacia abajo es buena noticia. Consulta es un contacto por WhatsApp; cotización o reserva es lo más cerca de una venta que el panel puede medir hoy."
      >
        <div className="indicadores">
          <Kpi rotulo="Inversión" familia="costo" valor={plata(hoy.inversion)}
               variacion={variacionNeutra(hoy.inversion, antes.inversion)} />
          <Kpi rotulo="Impresiones" familia="volumen" valor={numero(hoy.impresiones)}
               variacion={variacion(hoy.impresiones, antes.impresiones)} />
          <Kpi rotulo="Clics" familia="volumen" valor={numero(hoy.clics)}
               variacion={variacion(hoy.clics, antes.clics)} />
          <Kpi rotulo="Consultas" familia="volumen" valor={numero(hoy.leads)}
               variacion={variacion(hoy.leads, antes.leads)}
               pie="WhatsApp: Meta y Google" />
          <Kpi rotulo="Cotizaciones y reservas" familia="volumen" valor={numero(hoy.cotizaciones)}
               variacion={variacion(hoy.cotizaciones, antes.cotizaciones)}
               pie="lo más cerca de una venta" />
          <Kpi rotulo="Costo por cotización" familia="costo" valor={plata(hoy.costoCotizacion)}
               variacion={variacion(hoy.costoCotizacion, antes.costoCotizacion, true)} />
        </div>
      </Seccion>

      <Seccion
        titulo="Inversión día a día"
        bajada="Cada barra es un día. El naranja es Meta y el azul es Google. Pasa el cursor por encima para ver el detalle y haz clic en la leyenda para apagar un canal."
      >
        <Tarjeta>
          <BarrasDia datos={gastoDia} formato="plata" />
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="Cuánta gente vio y cuánta entró"
        bajada={
          hayAnio
            ? "La línea oscura es este período; la gris punteada, los mismos días de la semana hace un año. Pasa el cursor para ver los dos valores y haz clic en la leyenda para apagar una serie. Impresiones y clics van en gráficos separados porque tienen tamaños muy distintos."
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
      </Seccion>

      {conectado ? (
        /* El año y medio de historia es la consulta más pesada: llega por su
           cuenta, sin frenar los indicadores de arriba. */
        <Suspense fallback={<EsqueletoMesAMes />}>
          <MesAMes desde={inicioAnual} hasta={tope12} />
        </Suspense>
      ) : null}

      <Seccion
        titulo="Campaña por campaña"
        bajada="Ordenadas por lo que gastaron. Δ compara contra el período anterior. Intención es apretar «Cotizar» o «Reservar». Consulta es un contacto por WhatsApp: en Meta, una conversación que de verdad empezó; en Google, el clic en el botón (quien aprieta y no escribe igual suma). Cotiza o reserva son formularios enviados y reservas pagadas: solo se miden en Google, porque las campañas de Meta llevan a WhatsApp y su cierre no se ve hasta conectar Eventia."
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
                <th>Intención</th>
                <th>Consultas</th>
                <th>Cotiza o reserva</th>
                <th>Costo por cotización</th>
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
                    <td className="n">{c.canal === "google" ? numero(c.intenciones) : "—"}</td>
                    <td className="n">{numero(c.leads)}</td>
                    <td className="n">{c.canal === "google" ? numero(c.cotizaciones) : "—"}</td>
                    <td className="n">{c.canal === "google" ? plata(c.costoCotizacion) : "—"}</td>
                    <td><Var v={a && c.canal === "google" ? variacion(c.costoCotizacion, a.costoCotizacion, true) : null} /></td>
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
                <td className="n">{numero(hoy.intenciones)}</td>
                <td className="n">{numero(hoy.leads)}</td>
                <td className="n">{numero(hoy.cotizaciones)}</td>
                <td className="n">{plata(hoy.costoCotizacion)}</td>
                <td><Var v={variacion(hoy.costoCotizacion, antes.costoCotizacion, true)} /></td>
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
                  ...(c.canal === "google" ? [["Intención", numero(c.intenciones)]] : []),
                  ["Consultas", numero(c.leads)],
                  ["Costo por consulta", plata(c.cpl)],
                  ...(c.canal === "google"
                    ? [["Cotizaciones y reservas", numero(c.cotizaciones)], ["Costo por cotización", plata(c.costoCotizacion)]]
                    : []),
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
        {conBase ? (
          <>
            Datos de la base propia del panel, que se actualiza cada mañana (Meta al{" "}
            {ultimoDia.meta ? fechaLarga(ultimoDia.meta) : "—"}, Google al{" "}
            {ultimoDia.google ? fechaLarga(ultimoDia.google) : "—"}). Para traer el día de hoy, usa «Actualizar hoy» en
            Medición.
          </>
        ) : null}
        {!conBase && ahora.metaEnVivo
          ? "Meta en vivo desde su API, refrescado cada hora."
          : conBase ? "" : `Meta cargado a mano hasta el ${fechaLarga(ULTIMO_DIA_META)}.`}{" "}
        {conBase ? "" : ahora.googleEnVivo
          ? "Google Ads en vivo desde Analytics, refrescado cada hora."
          : "Google Ads cargado a mano."}{" "}
        Las campañas actuales de Google partieron el 14 de septiembre.
      </p>
    </div>
  );
}

async function MesAMes({ desde, hasta }: { desde: string; hasta: string }) {
  const anual = await serieAnual(desde, hasta);
  if (!anual) return null;
  const mensual = (campo: "inversion" | "impresiones" | "clics") => mesesDelAnio(anual.serie(campo), hasta);
  const gastoMes = mensual("inversion");
  const imprMes = mensual("impresiones");
  const clicsMes = mensual("clics");

  return (
    <Seccion
      titulo={`Mes a mes: ${imprMes.anio} contra ${imprMes.anio - 1}`}
      bajada={`Google Ads y Meta sumados. Gris es ${imprMes.anio - 1}; oscuro, ${imprMes.anio}. El mes en curso se compara contra los mismos días del año pasado, para no poner un mes a medias contra uno completo. No cambia con el filtro de fechas.`}
    >
      {anual.faltaMeta || anual.faltaGoogle ? (
        <div className="aviso ojo" style={{ marginBottom: 14 }}>
          <b>Ojo: estos tres gráficos están incompletos.</b>{" "}
          {anual.faltaMeta && anual.faltaGoogle
            ? "Ni Meta ni Google Ads respondieron."
            : anual.faltaMeta
              ? "Meta no respondió, así que solo se ve Google Ads: el gasto real fue más alto."
              : "Google Ads no respondió, así que solo se ve Meta: el gasto real fue más alto."}{" "}
          Se arreglan solos cuando la fuente vuelva a responder.
        </div>
      ) : null}

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
    </Seccion>
  );
}

function EsqueletoMesAMes() {
  return (
    <section>
      <div className="hueso linea-hueso" />
      <div className="pila">
        <div className="hueso tarjeta-hueso" />
        <div className="hueso tarjeta-hueso" />
        <div className="hueso tarjeta-hueso" />
      </div>
    </section>
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
