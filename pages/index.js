import dynamic from "next/dynamic";
import { useState } from "react";
import Results from "../components/Results";

// Import dinámico: Leaflet toca `window` apenas se carga, así que TODO lo
// relacionado con el mapa (incluido LocationMarker, que usa useMapEvents)
// tiene que cargarse solo en el navegador, nunca en el servidor.
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const LocationMarker = dynamic(() => import("../components/LocationMarker"), { ssr: false });

// Combina clima + contaminación lumínica + luz de luna en un consejo único.
function generarConsejo(clima, bortle, iluminacionLunarPorc) {
  const razones = [];
  let puntaje = 0;

  if (clima.clouds < 30) puntaje += 2;
  else if (clima.clouds < 70) {
    puntaje += 1;
    razones.push("nubosidad moderada");
  } else {
    razones.push("nubosidad alta");
  }

  if (clima.wind > 25) razones.push("viento fuerte");
  else puntaje += 1;

  if (bortle !== null && bortle !== undefined) {
    if (bortle <= 4) puntaje += 2;
    else if (bortle <= 6) {
      puntaje += 1;
      razones.push("algo de contaminación lumínica");
    } else {
      razones.push("mucha contaminación lumínica en la zona");
    }
  }

  if (iluminacionLunarPorc !== null && iluminacionLunarPorc !== undefined) {
    if (iluminacionLunarPorc > 70) razones.push("luna muy iluminada (dificulta ver objetos débiles)");
    else puntaje += 1;
  }

  if (puntaje >= 5) return { nivel: "Excelente", texto: "Excelente noche para observación astronómica." };
  if (puntaje >= 3) {
    return {
      nivel: "Buena",
      texto: razones.length ? `Buena noche, con algunas limitaciones: ${razones.join(", ")}.` : "Buena noche para observar.",
    };
  }
  return {
    nivel: "Regular",
    texto: razones.length ? `Condiciones difíciles: ${razones.join(", ")}.` : "Condiciones poco favorables esta noche.",
  };
}

export default function Home() {
  const [coords, setCoords] = useState(null);
  const [data, setData] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchJSON(url) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error de red");
    return json;
  }

  async function fetchWeatherPromedio(lat, lon) {
    const forecast = await fetchJSON(`/api/weather?lat=${lat}&lon=${lon}`);
    const proximos = forecast.slice(0, 2);
    return proximos.reduce(
      (acc, item) => ({
        temp: acc.temp + item.temperatura / proximos.length,
        clouds: acc.clouds + item.nubosidad / proximos.length,
        humidity: acc.humidity + item.humedad / proximos.length,
        wind: acc.wind + item.viento / proximos.length,
      }),
      { temp: 0, clouds: 0, humidity: 0, wind: 0 }
    );
  }

  async function handleMapClick(latlng) {
    setErrorMsg("");
    setLoading(true);
    setData(null);
    setAdvice(null);
    setCoords(latlng);

    const { lat, lng } = latlng;

    const [weatherResult, solYLunaResult, bortleResult] = await Promise.allSettled([
      fetchWeatherPromedio(lat, lng),
      fetchJSON(`/api/solyluna?lat=${lat}&lon=${lng}`),
      fetchJSON(`/api/bortle?lat=${lat}&lon=${lng}`),
    ]);

    const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
    const solLuna = solYLunaResult.status === "fulfilled" ? solYLunaResult.value : null;
    const bortle = bortleResult.status === "fulfilled" ? bortleResult.value.bortle : null;

    if (!weather) {
      setErrorMsg("No se pudo obtener el clima para este punto. Probá con otra ubicación.");
      setLoading(false);
      return;
    }

    setData({ weather, solLuna, bortle });
    setAdvice(generarConsejo(weather, bortle, solLuna?.iluminacionLunarPorc));
    setLoading(false);
  }

  return (
    <div className="pagina" style={{ textAlign: "center" }}>
      <header>
        <img src="/logo.png" alt="Logo Astroturismo" className="logo" />
        <h1 className="titulo">Astroturismo Inteligente</h1>
        <p className="contacto">Contacto: info@astroturismo.com.ar</p>
        <nav className="nav-botones">
          <button className="boton-naranja" onClick={() => alert("Esta app permite planificar noches astronómicas.")}>
            Descripción
          </button>
          <button className="boton-naranja" onClick={() => alert("Somos un equipo dedicado a la divulgación científica.")}>
            Quiénes somos
          </button>
          <button className="boton-naranja" onClick={() => alert("Los datos se obtienen de varias fuentes y se combinan.")}>
            Precisión de los datos
          </button>
        </nav>
      </header>

      <p className="instrucciones">Hacé clic en el mapa para ver el clima, sol/luna y contaminación lumínica del lugar.</p>

      <MapContainer center={[-34.6037, -58.3816]} zoom={5} className="leaflet-container">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationMarker onSelect={handleMapClick} />
      </MapContainer>

      {loading && <p className="estado-carga">Cargando datos...</p>}
      {errorMsg && <p className="error-clima">{errorMsg}</p>}
      {coords && (
        <p className="coordenadas">
          Coordenadas: Lat {coords.lat.toFixed(5)}, Lng {coords.lng.toFixed(5)}
        </p>
      )}

      {data && <Results data={data} advice={advice} />}
    </div>
  );
}
