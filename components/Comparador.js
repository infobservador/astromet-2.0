function formatFechaLarga(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

const colorPorNivel = {
  Excelente: "#8ee6a0",
  Buena: "#ffd27a",
  Regular: "#ffb4a2",
  Mediocre: "#ffb4a2",
  Mala: "#ff8080",
  Peligro: "#ff4d4d",
};

export default function Comparador({ resultados, onElegirFecha }) {
  if (!resultados || resultados.length === 0) {
    return <p>No se pudo calcular ninguna noche dentro del rango de pronóstico disponible.</p>;
  }

  return (
    <div className="comparador-lista">
      {resultados.map((noche, i) => (
        <div key={noche.fecha} className={`comparador-fila${noche.consejo.banderaRoja ? " comparador-fila-peligro" : ""}`}>
          <div className="comparador-puesto">{noche.consejo.banderaRoja ? "🚩" : `#${i + 1}`}</div>
          <div className="comparador-info">
            <div className="comparador-fecha">{formatFechaLarga(noche.fecha)}</div>
            <div className="comparador-metricas">
              {noche.consejo.banderaRoja
                ? `Se recomienda reprogramar: ${noche.consejo.motivosBanderaRoja.join(", ")}`
                : `${noche.promedio.temp.toFixed(0)}°C · ${noche.promedio.clouds.toFixed(0)}% nubosidad · ${
                    noche.solLuna ? `${noche.solLuna.iluminacionLunarPorc}% luna` : "sin datos de luna"
                  }`}
            </div>
          </div>
          <div className="comparador-nivel" style={{ color: colorPorNivel[noche.consejo.nivel] || "inherit" }}>
            {noche.consejo.nivel}
          </div>
          <button className="boton-naranja comparador-boton" onClick={() => onElegirFecha(noche.fecha)}>
            Ver detalle
          </button>
        </div>
      ))}
    </div>
  );
}
