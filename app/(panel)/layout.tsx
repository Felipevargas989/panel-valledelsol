import { Suspense } from "react";
import Vistas from "../../components/Vistas";
import { RANGO_DATOS } from "../../lib/datos";
import { fechaLarga } from "../../lib/calculos";
import { ga4Conectado } from "../../lib/ga4";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const conCandado = Boolean(process.env.PANEL_CLAVE);
  const conAnalytics = ga4Conectado();

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
            {conAnalytics ? <span className="sello">● Analytics en vivo</span> : null}
            <span className="sello">Meta y Google a mano · al {fechaLarga(RANGO_DATOS.hasta)}</span>
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
