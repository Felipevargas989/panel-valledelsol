import { Suspense } from "react";
import FiltroFechas from "../../../components/FiltroFechas";
import { BarrasH, type FilaBarra } from "../../../components/graficos";
import { Seccion, Tarjeta, Leyenda } from "../../../components/ui";
import { PUBLICO } from "../../../lib/datos";
import { plata, numero, porcentaje, sumarDias, hoyEnChile, fechaCorta, duracionTexto } from "../../../lib/calculos";
import { datosSitio, ga4Conectado } from "../../../lib/ga4";
import { metaConectado, metaPublico, explicarErrorMeta, type PublicoMeta } from "../../../lib/meta";
import { baseConectada, publicoMetaDesdeBase, sitioDesdeBase, INICIO_BASE } from "../../../lib/base";

export const dynamic = "force-dynamic";

const normal = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const GRAN_CONCE = ["concepcion", "san pedro de la paz", "talcahuano", "coronel", "hualpen", "chiguayante", "penco", "tome", "lota"];

type Sitio = {
  enVivo: boolean;
  periodo: string;
  usuarios: number;
  sesiones: number;
  interaccion: number;
  tiempoMedio: string;
  canales: Array<[string, number]>;
  ciudades: Array<[string, number]>;
  dispositivo: Array<[string, number]>;
  sistema: Array<[string, number]>;
  paginas: Array<[string, number]>;
};

/** Últimos 30 días cerrados desde Analytics; si no está conectado o falla,
 *  la foto cargada a mano el 15-09. */
async function leerSitio(desde: string, hasta: string): Promise<Sitio> {
  const g = PUBLICO.ga;
  const foto: Sitio = {
    enVivo: false, periodo: PUBLICO.periodoGa, usuarios: g.usuarios, sesiones: g.sesiones,
    interaccion: g.interaccion, tiempoMedio: g.tiempoMedio, canales: g.canales, ciudades: g.ciudades,
    dispositivo: g.dispositivo, sistema: g.sistema, paginas: g.paginas,
  };
  if (!baseConectada() && !ga4Conectado()) return foto;
  try {
    const d = baseConectada() ? await sitioDesdeBase(desde, hasta) : await datosSitio(desde, hasta);
    return {
      enVivo: true,
      periodo: `${fechaCorta(desde)} – ${fechaCorta(hasta)} · en vivo`,
      usuarios: d.actual.personas,
      sesiones: d.actual.sesiones,
      interaccion: d.actual.sesiones > 0 ? d.actual.interactivas / d.actual.sesiones : NaN,
      tiempoMedio: duracionTexto(d.actual.duracionMedia),
      canales: d.canales.map((c) => [c.nombre, c.sesiones]),
      ciudades: d.ciudades,
      dispositivo: d.dispositivos,
      sistema: d.sistemas,
      paginas: d.paginas,
    };
  } catch {
    return foto;
  }
}

type Meta = PublicoMeta & { enVivo: boolean; periodo: string; error: string | null };

/** Últimos 30 días cerrados desde la API de Meta, todas las campañas; si no
 *  está conectada o falla, la foto de Cabañas cargada a mano el 15-09. */
async function leerMeta(desde: string, hasta: string): Promise<Meta> {
  const P = PUBLICO;
  const foto: Meta = {
    enVivo: false, periodo: P.periodoMeta, error: null, edad: P.edad, genero: P.genero,
    plataforma: P.plataforma, ubicaciones: P.ubicaciones, regiones: P.regiones,
  };
  if (!baseConectada() && !metaConectado()) return foto;
  try {
    const d = baseConectada() ? await publicoMetaDesdeBase(desde, hasta) : await metaPublico(desde, hasta);
    return { ...d, enVivo: true, error: null, periodo: `${fechaCorta(desde)} – ${fechaCorta(hasta)} · en vivo` };
  } catch (e) {
    return { ...foto, error: explicarErrorMeta(e) };
  }
}

export default async function Publico({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const P = PUBLICO;
  const conBase = baseConectada();
  // Últimos 30 días cerrados por defecto. Con la base propia el rango se
  // puede cambiar; sin ella, la radiografía es de período fijo.
  const ayer = sumarDias(hoyEnChile(), -1);
  const sp = await searchParams;
  const hasta = conBase && sp.hasta && sp.hasta <= hoyEnChile() ? sp.hasta : ayer;
  const desde = conBase && sp.desde && sp.desde <= hasta ? sp.desde : sumarDias(hasta, -29);
  const [M, S] = await Promise.all([leerMeta(desde, hasta), leerSitio(desde, hasta)]);

  // Conversaciones con su costo al lado
  const conCosto = (xs: Array<[string, number, number]>): FilaBarra[] =>
    xs.map(([et, valor, costo]) => ({
      et,
      valor,
      texto: numero(valor),
      detalle: plata(costo),
    }));

  const simple = (xs: Array<[string, number]>): FilaBarra[] =>
    xs.map(([et, valor]) => ({ et, valor, texto: numero(valor) }));

  const regiones: FilaBarra[] = M.regiones.map(([et, gasto, contactos, enZona]) => ({
    et,
    valor: gasto,
    texto: plata(gasto),
    detalle: `${numero(contactos)} contactos`,
    color: enZona ? "meta" : "otro",
  }));

  const terminos: FilaBarra[] = P.terminos.map(([texto, grupo, veces, sirve]) => ({
    et: texto,
    valor: veces,
    texto: numero(veces),
    detalle: grupo,
    color: sirve ? "google" : "otro",
  }));

  const mismoPeriodo = M.enVivo && S.enVivo;

  return (
    <div className="pila">
      {conBase ? (
        <>
          <Suspense fallback={<div className="filtros" style={{ minHeight: 62 }} />}>
            <FiltroFechas desde={desde} hasta={hasta} min={INICIO_BASE} max={ayer} atajos={[30, 90, 180]} conTodo={false} />
          </Suspense>
          <div className="aviso info">
            <b>Con pocos días las proporciones se vuelven ruido.</b> Treinta días es un buen mínimo para leer quién te
            ve; la radiografía de Meta existe en la base desde el 17 de junio de 2026.
          </div>
        </>
      ) : (
        <div className="aviso info">
          <b>Estas cifras no cambian con el filtro de fechas.</b> Son el retrato de quién te ve, y para eso
          hace falta el período completo: con pocos días las proporciones se vuelven ruido.{" "}
          {mismoPeriodo
            ? "Meta y el sitio cubren los mismos últimos 30 días cerrados y se actualizan solos."
            : `Meta va del ${M.periodo} y el sitio del ${S.periodo}.`}
        </div>
      )}

      {M.error ? (
        <div className="aviso ojo">
          <b>Meta no se pudo leer en vivo; se muestra la foto cargada a mano.</b> {M.error}
        </div>
      ) : null}

      <Seccion
        titulo="Quién te escribe por Meta"
        periodo={M.periodo}
        bajada={
          M.enVivo
            ? "Conversaciones de WhatsApp iniciadas y lo que costó cada una, sumando todas las campañas de Meta del período. Acá se ve a quién le está hablando de verdad el anuncio, más allá de a quién apuntaste."
            : "Conversaciones iniciadas y lo que costó cada una en la campaña de Cabañas. Acá se ve a quién le está hablando de verdad el anuncio, más allá de a quién apuntaste."
        }
      >
        <div className="rejilla dos">
          <Tarjeta titulo="Por edad" extra="conversaciones · costo de cada una" nota={notaEdad(M)}>
            <BarrasH filas={conCosto(M.edad)} color="meta" />
          </Tarjeta>

          <Tarjeta titulo="Por género" extra="conversaciones · costo de cada una" nota={notaGenero(M)}>
            <BarrasH filas={conCosto(M.genero)} color="meta" />
          </Tarjeta>

          <Tarjeta titulo="Instagram contra Facebook" extra="conversaciones · costo de cada una"
                   nota={notaPlataforma(M)}>
            <BarrasH filas={conCosto(M.plataforma)} color="meta" />
          </Tarjeta>

          <Tarjeta titulo="Dónde se gastó la plata" extra="por región"
                   nota="Por región Meta no entrega conversaciones iniciadas sino «contactos»: cualquier mensaje, también los de quien ya había escrito antes. Por eso estos números no suman lo mismo que las otras tarjetas.">
            <BarrasH filas={regiones} />
            <div style={{ marginTop: 12 }}>
              <Leyenda items={[["Tu zona", "var(--meta)"], ["Fuera de la zona", "var(--otro)"]]} />
            </div>
          </Tarjeta>
        </div>

        <NotaZona M={M} />
      </Seccion>

      <Seccion
        titulo="Quién entra al sitio"
        periodo={S.periodo}
        bajada={`${numero(S.usuarios)} personas y ${numero(S.sesiones)} visitas, con ${porcentaje(S.interaccion, 0)} de interacción y ${S.tiempoMedio} de permanencia por visita.`}
      >
        <div className="rejilla dos">
          <Tarjeta titulo="De dónde llegan" extra="visitas" nota={notaCanales(S)}>
            <BarrasH filas={simple(S.canales)} color="sitio" />
          </Tarjeta>

          <Tarjeta titulo="Desde qué ciudad" extra="personas" nota={notaCiudades(S)}>
            <BarrasH filas={simple(S.ciudades)} color="sitio" />
          </Tarjeta>

          <Tarjeta titulo="Con qué aparato" extra="personas" nota={notaAparato(S)}>
            <BarrasH filas={simple(S.dispositivo)} color="sitio" />
          </Tarjeta>

          <Tarjeta titulo="Con qué sistema" extra="personas"
                   nota={`${S.sistema[0]?.[0] ?? "—"} manda y ${S.sistema[1]?.[0] ?? "—"} va segundo. Por eso importa verificar el dominio en Meta: sin eso, la medición en iPhone pierde precisión y se subestima lo que trae la pauta.`}>
            <BarrasH filas={simple(S.sistema)} color="sitio" />
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion
        titulo="Qué miran cuando llegan"
        periodo={S.enVivo ? S.periodo : "18 ago – 14 sep 2026"}
        bajada="Las páginas más vistas del período."
      >
        <Tarjeta nota={S.paginas.length > 1 ? `Después de «${S.paginas[0][0]}», lo más visto es «${S.paginas[1][0]}».` : undefined}>
          <BarrasH filas={simple(S.paginas)} color="sitio" />
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="Qué buscan en Google"
        periodo="14 – 15 sep 2026"
        bajada="Las búsquedas reales donde apareció tu anuncio. De acá salen las palabras que hay que bloquear. Son dos días nada más: con una semana esto se vuelve mucho más útil."
      >
        <div className="rejilla dos">
          <Tarjeta titulo="Búsquedas donde apareciste" extra="veces que se mostró">
            <BarrasH filas={terminos} />
            <div style={{ marginTop: 12 }}>
              <Leyenda
                items={[["Búsqueda que sirve", "var(--google)"], ["Intención equivocada", "var(--otro)"]]}
              />
            </div>
          </Tarjeta>

          <Tarjeta titulo="La alerta">
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta2)" }}>
              El grupo de iglesias y retiros está apareciendo en búsquedas de <b>hogares y asilos de
              ancianos</b>. La culpa la tiene la palabra «casa de retiro», que se entiende para los dos
              lados. Todavía no cuesta plata porque nadie hizo clic, pero hay que bloquear{" "}
              <i>hogar de ancianos</i>, <i>asilo</i> y <i>residencia de ancianos</i> antes de que alguien lo
              haga.
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--tinta2)" }}>
              Dato aparte y bueno: alguien buscó <i>salón de eventos La Escondida</i> —la competencia— y
              apareció tu anuncio. Eso está funcionando como debe.
            </p>
          </Tarjeta>
        </div>
      </Seccion>
    </div>
  );
}

// ── Notas que se escriben con los datos ──────────────────────
// Con Analytics en vivo los números cambian: un texto fijo como «siete de
// cada diez entran por el celular» dejaría de ser cierto. Por eso se arman
// a partir de lo que llega.

function notaCanales(S: Sitio) {
  const total = S.canales.reduce((a, c) => a + c[1], 0);
  const pago = S.canales.find((c) => c[0] === "Búsqueda pagada")?.[1] ?? 0;
  const primero = S.canales[0];
  if (!total || !primero) return undefined;
  return `Lo que más trae visitas es ${primero[0].toLowerCase()}, con el ${porcentaje(primero[1] / total, 0)}. La búsqueda pagada de Google aporta el ${porcentaje(pago / total, 0)}: partió el 14 de septiembre y debería crecer semana a semana.`;
}

function notaCiudades(S: Sitio) {
  const conce = S.ciudades.filter((c) => GRAN_CONCE.includes(normal(c[0]))).reduce((a, c) => a + c[1], 0);
  const stgo = S.ciudades.find((c) => normal(c[0]) === "santiago")?.[1] ?? 0;
  if (!conce) return undefined;
  return conce >= stgo
    ? `Sumando Concepción y las comunas vecinas, el Gran Concepción llega a ${numero(conce)} personas y supera a Santiago (${numero(stgo)}). La zona pesa más de lo que parece a primera vista.`
    : `Santiago (${numero(stgo)}) supera al Gran Concepción sumado (${numero(conce)}). Vale la pena mirar si esas visitas de Santiago terminan en reservas o solo miran.`;
}

function notaAparato(S: Sitio) {
  const total = S.dispositivo.reduce((a, c) => a + c[1], 0);
  const cel = S.dispositivo.find((c) => c[0] === "Celular")?.[1] ?? 0;
  if (!total) return undefined;
  return `${Math.round((cel / total) * 10)} de cada diez entran por el celular. Todo lo que se publique tiene que verse bien primero en pantalla chica.`;
}

// ── Notas de Meta ────────────────────────────────────────────
// Un costo con dos o tres conversaciones es ruido: para decir «el más barato»
// se exigen al menos cinco.
const MINIMO = 5;

function notaEdad(M: Meta) {
  const firmes = M.edad.filter((e) => e[1] >= MINIMO);
  if (firmes.length < 2) return undefined;
  const [a, b] = [...M.edad].sort((x, y) => y[1] - x[1]);
  const barato = [...firmes].sort((x, y) => x[2] - y[2])[0];
  const caro = [...firmes].sort((x, y) => y[2] - x[2])[0];
  return `Los grupos que más escriben son los de ${a[0]} y ${b[0]} años. Los de ${barato[0]} son los más baratos de conseguir (${plata(barato[2])}); los de ${caro[0]}, los más caros (${plata(caro[2])}).`;
}

function notaGenero(M: Meta) {
  const total = M.genero.reduce((s, g) => s + g[1], 0);
  const mujeres = M.genero.find((g) => g[0] === "Mujeres");
  const hombres = M.genero.find((g) => g[0] === "Hombres");
  if (!total || !mujeres || !hombres) return undefined;
  const diez = Math.round((mujeres[1] / total) * 10);
  const precio = mujeres[2] <= hombres[2] ? "y salen más baratas" : "aunque salen más caras";
  const consejo = diez >= 6
    ? " Quien arma el panorama suele ser ella: las fotos y el texto deberían hablarle a ella."
    : "";
  return `${diez} de cada diez conversaciones las inician mujeres, ${precio} (${plata(mujeres[2])} contra ${plata(hombres[2])}).${consejo}`;
}

function notaPlataforma(M: Meta) {
  const [a, b] = M.plataforma;
  if (!a || !b) return undefined;
  const firmes = M.ubicaciones.filter((u) => u[1] >= MINIMO);
  const mejor = [...firmes].sort((x, y) => x[2] - y[2])[0];
  const ubic = mejor ? ` La ubicación más barata es ${mejor[0]}: ${numero(mejor[1])} conversaciones a ${plata(mejor[2])}.` : "";
  return `${a[0]} trae ${numero(a[1])} conversaciones a ${plata(a[2])} cada una; ${b[0]}, ${numero(b[1])} a ${plata(b[2])}.${ubic}`;
}

/** Cuánto se fue fuera de Bío Bío y Ñuble. El público de Cabañas se acotó el
 *  15-09, así que mientras el período incluya días anteriores la fuga sigue
 *  apareciendo y se va apagando sola. */
function NotaZona({ M }: { M: Meta }) {
  const total = M.regiones.reduce((a, r) => a + r[1], 0);
  const dentro = M.regiones.filter((r) => r[3]);
  const fuera = M.regiones.filter((r) => !r[3]);
  const gastoFuera = fuera.reduce((a, r) => a + r[1], 0);
  if (!total) return null;
  const parte = gastoFuera / total;

  const gastoDentro = dentro.reduce((a, r) => a + r[1], 0);
  const contactosDentro = dentro.reduce((a, r) => a + r[2], 0);
  const santiago = fuera.find((r) => r[0] === "Santiago");
  const costoDentro = contactosDentro > 0 ? gastoDentro / contactosDentro : NaN;
  const costoStgo = santiago && santiago[2] > 0 ? santiago[1] / santiago[2] : NaN;

  if (parte < 0.03) {
    return (
      <div className="aviso info" style={{ marginTop: 14 }}>
        <b>La plata se queda en tu zona.</b> Solo {plata(gastoFuera)} ({porcentaje(parte, 0)}) se mostró fuera
        de Bío Bío y Ñuble en el período.
      </div>
    );
  }

  return (
    <div className="aviso ojo" style={{ marginTop: 14 }}>
      <b>Fuga fuera de la zona.</b> {plata(gastoFuera)} — el {porcentaje(parte, 0)} del gasto del período — se
      mostró fuera de Bío Bío y Ñuble. El 15 de septiembre el público de Cabañas quedó acotado a Chillán,
      Concepción y Los Ángeles, así que este número debería ir bajando a medida que el período deja atrás
      esa fecha; si no baja, alguna otra campaña sigue abierta a todo Chile.
      {isFinite(costoStgo) && isFinite(costoDentro) ? (
        <>
          {" "}Un matiz: el contacto de Santiago costó {plata(costoStgo)} contra {plata(costoDentro)} en tu
          zona, pero está a cinco horas de auto. Lo que importa no es el precio del contacto, sino cuántos
          terminan durmiendo en una cabaña.
        </>
      ) : null}
    </div>
  );
}
