import { BarrasH, type FilaBarra } from "../../../components/graficos";
import { Seccion, Tarjeta, Leyenda } from "../../../components/ui";
import { PUBLICO } from "../../../lib/datos";
import { plata, numero, porcentaje, sumarDias, hoyEnChile, fechaCorta, duracionTexto } from "../../../lib/calculos";
import { datosSitio, ga4Conectado } from "../../../lib/ga4";

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
async function leerSitio(): Promise<Sitio> {
  const g = PUBLICO.ga;
  const foto: Sitio = {
    enVivo: false, periodo: PUBLICO.periodoGa, usuarios: g.usuarios, sesiones: g.sesiones,
    interaccion: g.interaccion, tiempoMedio: g.tiempoMedio, canales: g.canales, ciudades: g.ciudades,
    dispositivo: g.dispositivo, sistema: g.sistema, paginas: g.paginas,
  };
  if (!ga4Conectado()) return foto;
  try {
    const hasta = sumarDias(hoyEnChile(), -1);
    const desde = sumarDias(hasta, -29);
    const d = await datosSitio(desde, hasta);
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

export default async function Publico() {
  const P = PUBLICO;
  const S = await leerSitio();
  const gastoTotal = P.regiones.reduce((a, r) => a + r[1], 0);
  const fuera = P.regiones.filter((r) => !r[3]);
  const gastoFuera = fuera.reduce((a, r) => a + r[1], 0);
  const contactosFuera = fuera.reduce((a, r) => a + r[2], 0);
  const dentro = P.regiones.find((r) => r[3])!;

  const costoDentro = dentro[2] > 0 ? dentro[1] / dentro[2] : NaN;
  const costoFuera = contactosFuera > 0 ? gastoFuera / contactosFuera : NaN;

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

  const regiones: FilaBarra[] = P.regiones.map(([et, gasto, contactos, enZona]) => ({
    et,
    valor: gasto,
    texto: plata(gasto),
    detalle: `${contactos} contactos`,
    color: enZona ? "meta" : "otro",
  }));

  const terminos: FilaBarra[] = P.terminos.map(([texto, grupo, veces, sirve]) => ({
    et: texto,
    valor: veces,
    texto: numero(veces),
    detalle: grupo,
    color: sirve ? "google" : "otro",
  }));

  return (
    <div className="pila">
      <div className="aviso info">
        <b>Estas cifras no cambian con el filtro de fechas.</b> Son el retrato de quién te ve, y para eso
        hace falta el período completo: con pocos días las proporciones se vuelven ruido. Meta va del{" "}
        {P.periodoMeta} y el sitio del {P.periodoGa}.
      </div>

      <Seccion
        titulo="Quién te escribe por Meta"
        periodo={P.periodoMeta}
        bajada="Conversaciones iniciadas y lo que costó cada una. Acá se ve a quién le está hablando de verdad el anuncio, más allá de a quién apuntaste."
      >
        <div className="rejilla dos">
          <Tarjeta
            titulo="Por edad"
            extra="conversaciones · costo de cada una"
            nota="El grueso está entre los 25 y los 54. Los de 25 a 34 son los más baratos de conseguir; los de 55 a 64, los más caros."
          >
            <BarrasH filas={conCosto(P.edad)} color="meta" />
          </Tarjeta>

          <Tarjeta
            titulo="Por género"
            extra="conversaciones · costo de cada una"
            nota="Dos de cada tres conversaciones las inician mujeres, y salen más baratas. Quien arma el panorama suele ser ella: las fotos y el texto deberían hablarle a ella."
          >
            <BarrasH filas={conCosto(P.genero)} color="meta" />
          </Tarjeta>

          <Tarjeta
            titulo="Instagram contra Facebook"
            extra="conversaciones · costo de cada una"
            nota={`Instagram trae más conversaciones y cada una cuesta ${plata(P.plataforma[0][2])} contra ${plata(P.plataforma[1][2])} de Facebook. Dentro de Facebook, lo que mejor rinde son los Reels (${P.ubicaciones[0][1]} a ${plata(P.ubicaciones[0][2])}) y las Historias.`}
          >
            <BarrasH filas={conCosto(P.plataforma)} color="meta" />
          </Tarjeta>

          <Tarjeta titulo="Dónde se gastó la plata" extra="por región">
            <BarrasH filas={regiones} />
            <div style={{ marginTop: 12 }}>
              <Leyenda items={[["Tu zona", "var(--meta)"], ["Fuera de la zona", "var(--otro)"]]} />
            </div>
          </Tarjeta>
        </div>

        <div className="aviso ojo" style={{ marginTop: 14 }}>
          <b>La fuga que se corrigió.</b> {plata(gastoFuera)} — el{" "}
          {porcentaje(gastoFuera / gastoTotal, 0)} del gasto del mes — se mostró fuera de la zona. El 15 de
          septiembre el público quedó acotado a Chillán, Concepción y Los Ángeles, así que esto debería
          desaparecer del próximo corte. Un matiz que conviene mirar: el contacto de Santiago salió más
          barato ({plata(costoFuera)} contra {plata(costoDentro)} en Bío Bío), pero está a cinco horas de
          auto. Lo que hay que vigilar no es el precio del contacto, sino cuántos de esos terminan durmiendo
          en una cabaña.
        </div>
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
