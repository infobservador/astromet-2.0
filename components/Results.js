function formatHora(iso) {
  if (!iso) return "No disponible";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "No disponible";
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const colorPorNivel = {
  Excelente: "#8ee6a0",
  Buena: "#ffd27a",
  Regular: "#ffb4a2",
};

export default function Results({ data, advice }) {
  const { weather, solLuna, bortle } = data;

  return (
    <div className="panel-resultados">
      {advice && (
        <p className="consejo" style={{ color: colorPorNivel[advice.nivel] || "inherit" }}>
          {advice.nivel}: {advice.texto}
        </p>
      )}

      <h3>Clima</h3>
      <ul>
        <li>Temperatura: {weather.temp.toFixed(1)} °C</li>
        <li>Nubosidad: {weather.clouds.toFixed(0)}%</li>
        <li>Humedad: {weather.humidity.toFixed(0)}%</li>
        <li>Viento: {weather.wind.toFixed(1)} m/s</li>
      </ul>

      <h3>Sol y Luna</h3>
      {solLuna ? (
        <ul>
          <li>Puesta de sol: {formatHora(solLuna.puestaSol)}</li>
          <li>Comienza la noche astronómica (cielo totalmente oscuro): {formatHora(solLuna.inicioNocheAstronomica)}</li>
          <li>Termina la noche astronómica: {formatHora(solLuna.finNocheAstronomica)}</li>
          <li>Salida del sol: {formatHora(solLuna.salidaSol)}</li>
          <li>
            Luna:{" "}
            {solLuna.lunaSiempreArriba
              ? "no se pone hoy"
              : solLuna.lunaSiempreAbajo
              ? "no sale hoy"
              : `sale ${formatHora(solLuna.salidaLuna)}, se pone ${formatHora(solLuna.puestaLuna)}`}
          </li>
          <li>Iluminación lunar: {solLuna.iluminacionLunarPorc}%</li>
        </ul>
      ) : (
        <p>No se pudieron calcular los horarios de sol y luna.</p>
      )}

      <h3>Contaminación lumínica</h3>
      <p>Escala de Bortle: {bortle !== null && bortle !== undefined ? bortle : "No disponible"}</p>
      {data.bortleComentario && <p className="bortle-comentario">{data.bortleComentario}</p>}
    </div>
  );
}
