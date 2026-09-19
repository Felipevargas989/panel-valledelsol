// Lo que se ve mientras el servidor pide los datos a Google y Meta. Antes
// la página quedaba en blanco esos 2 o 3 segundos y se sentía lenta.
export default function Cargando() {
  return (
    <div className="pila" aria-busy="true" aria-label="Cargando los datos">
      <div className="hueso filtros-hueso" />
      <div className="indicadores">
        {Array.from({ length: 6 }, (_, i) => <div className="hueso kpi-hueso" key={i} />)}
      </div>
      <div className="hueso tarjeta-hueso" />
      <div className="rejilla dos">
        <div className="hueso tarjeta-hueso" />
        <div className="hueso tarjeta-hueso" />
      </div>
    </div>
  );
}
