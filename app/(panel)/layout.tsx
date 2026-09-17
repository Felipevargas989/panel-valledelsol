import { Suspense } from "react";
import Vistas from "../../components/Vistas";
import { RANGO_DATOS } from "../../lib/datos";
import { fechaLarga } from "../../lib/calculos";
import { ga4Conectado } from "../../lib/ga4";
import { metaConectado, metaResponde } from "../../lib/meta";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const conCandado = Boolean(process.env.PANEL_CLAVE);
  const conAnalytics = ga4Conectado();
  const conMeta = await metaResponde();
  // Google Ads se lee a través de Analytics: cae con la misma llave.
  const enVivo = [conAnalytics && "Analytics", conAnalytics && "Google Ads", conMeta && "Meta"].filter(Boolean);
  const aMano = [!conMeta && "Meta", !conAnalytics && "Google"].filter(Boolean);
  const lista = (xs: unknown[]) => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : String(xs[0]);

  return (
    <>
      <header className="banda">
        <div className="banda-in">
          <div className="marca">
            <div className="marca-icono" aria-hidden="true">▲</div>
            <div>
              <h1>Panel Valle del Sol</h1>
              <p>Google Ads, Meta y el sitio en un solo lugar</p>
            </div>
          </div>
          <div className="banda-dcha">
            {enVivo.length ? <span className="sello">● {lista(enVivo)} en vivo</span> : null}
            {aMano.length ? (
              <span className="sello">{lista(aMano)} a mano · al {fechaLarga(RANGO_DATOS.hasta)}</span>
            ) : null}
            {metaConectado() && !conMeta ? <span className="sello">⚠ Meta no responde</span> : null}
            {!conCandado ? <span className="sello">⚠ Sin candado</span> : null}
          </div>
        </div>
        <div className="banda-in" style={{ paddingTop: 0 }}>
          <Suspense fallback={<nav className="vistas" />}>
            <Vistas />
          </Suspense>
        </div>
      </header>
      <main className="cuerpo">
        {!conCandado ? (
          <div className="aviso ojo" style={{ marginBottom: 20 }}>
            <b>Esta página está abierta a cualquiera que tenga el enlace.</b> Para cerrarla, agrega la
            variable <code>PANEL_CLAVE</code> en Vercel con la clave que tú elijas y vuelve a publicar.
          </div>
        ) : null}
        {children}
      </main>
    </>
  );
}
