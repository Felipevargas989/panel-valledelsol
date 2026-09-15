import { BarrasH, type FilaBarra } from "../../../components/graficos";
import { Seccion, Tarjeta, Leyenda } from "../../../components/ui";
import { PUBLICO } from "../../../lib/datos";
import { plata, numero, porcentaje } from "../../../lib/calculos";

export default function Publico() {
  const P = PUBLICO;
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
        periodo={P.periodoGa}
        bajada={`${numero(P.ga.usuarios)} personas y ${numero(P.ga.sesiones)} visitas en el período, con ${porcentaje(P.ga.interaccion, 0)} de interacción y ${P.ga.tiempoMedio} de permanencia.`}
      >
        <div className="rejilla dos">
          <Tarjeta
            titulo="De dónde llegan"
            extra="visitas"
            nota="La pauta de Google recién parte: hoy es una porción chica y debería crecer semana a semana. Lo que manda hoy es la gente que llega sola y la que busca en Google sin pagar."
          >
            <BarrasH filas={simple(P.ga.canales)} color="sitio" />
          </Tarjeta>

          <Tarjeta
            titulo="Desde qué ciudad"
            extra="personas"
            nota={`Santiago aparece primero, pero sumando Concepción, San Pedro, Talcahuano, Coronel y Hualpén, el Gran Concepción llega a ${numero(P.ga.granConce)} personas y lo supera. La zona pesa más de lo que parece a primera vista.`}
          >
            <BarrasH filas={simple(P.ga.ciudades)} color="sitio" />
          </Tarjeta>

          <Tarjeta
            titulo="Con qué aparato"
            extra="personas"
            nota="Siete de cada diez entran por el celular. Todo lo que se publique tiene que verse bien primero en pantalla chica."
          >
            <BarrasH filas={simple(P.ga.dispositivo)} color="sitio" />
          </Tarjeta>

          <Tarjeta
            titulo="Con qué sistema"
            extra="personas"
            nota="Android manda y el iPhone va segundo. Por eso importa verificar el dominio en Meta: sin eso, la medición en iPhone pierde precisión y se subestima lo que trae la pauta."
          >
            <BarrasH filas={simple(P.ga.sistema)} color="sitio" />
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion
        titulo="Qué miran cuando llegan"
        periodo="18 ago – 14 sep 2026"
        bajada={`${numero(P.ga.vistasTotales)} vistas de página en el período.`}
      >
        <Tarjeta nota="Después de la portada, cabañas dobla a cualquier otra sección. El interés natural del público está ahí, y calza con que la campaña de cabañas sea la que trae conversaciones.">
          <BarrasH filas={simple(P.ga.paginas)} color="sitio" />
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
