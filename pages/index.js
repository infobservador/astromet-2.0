import dynamic from "next/dynamic";
import { useState } from "react";
import Results from "../components/Results";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const LocationMarker = dynamic(() => import("../components/LocationMarker"), { ssr: false });

const INFO_BOTONES = {
  descripcion: {
    titulo: "Descripción",
    texto:
      "Astroturismo Inteligente te ayuda a decidir si conviene salir a observar el cielo en un lugar y una franja horaria determinada. " +
      "Combina pronóstico del clima, horarios de sol y luna, y una estimación de contaminación lumínica en un solo consejo.",
  },
  quienes: {
    titulo: "Quiénes somos",
    texto: "Instituto Latinoamericano de Astroturismo. Contacto: info@astroturismo.com.ar",
  },
  precision: {
    titulo: "Fuentes y precisión técnica",
    texto:
      "Clima: pronóstico de OpenWeather (bloques de 3 horas, hasta 5 días hacia adelante; más allá de eso no hay datos disponibles). " +
      "Sol y luna: calculado matemáticamente con la librería SunCalc (alta precisión). " +
      "Contaminación lumínica (escala de Bortle): ESTIMADA según si el punto está en una ciudad, pueblo, zona rural o área protegida " +
      "(datos de OpenStreetMap), no proviene de mediciones satelitales reales. Es una aproximación, no un valor certificado. " +
      "Nombre del lugar: geocodificación de OpenStreetMap/Nominatim, puede no ser exacto en zonas muy despobladas.",
  },
};

function construirRangoFechaHora(fecha, desdeHora, hastaHora) {
  const desdeH = parseInt(desdeHora, 10);
  const hastaH = parseInt(hastaHora, 10);

  if (!fecha) return { error: "Elegí una fecha." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "La fecha no tiene un formato válido." };
  if (isNaN(desdeH) || desdeH < 0 || desdeH > 23) return { error: "La hora 'Desde' debe ser un número entre 0 y 23." };
  if (isNaN(hastaH) || hastaH < 0 || hastaH > 23) return { error: "La hora 'Hasta' debe ser un número entre 0 y 23." };

  const desde = new Date(`${fecha}T${String(desdeH).padStart(2, "0")}:00:00`);
  let hasta = new Date(`${fecha}T${String(hastaH).padStart(2, "0")}:00:00`);

  if (isNaN(desde.getTime())) return { error: "La fecha elegida no es válida." };

  // Si "hasta" es igual o anterior a "desde", asumimos que cruza la medianoche (ej: 19hs a 3hs del otro día).
  if (hasta <= desde) {
    hasta = new Date(hasta.getTime() + 24 * 60 * 60 * 1000);
  }

  const ahora = new Date();
  const limiteMax = new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000);

  if (hasta < new Date(ahora.getTime() - 3 * 60 * 60 * 1000)) {
    return { error: "La fecha/hora elegida ya pasó." };
  }
  if (desde > limiteMax) {
    return { error: "Solo se puede pronosticar el clima hasta 5 días hacia adelante." };
  }

  return { desde, hasta };
}

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

function hoyISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const [coords, setCoords] = useState(null);
  const [centrarEn, setCentrarEn] = useState(null);
  const [lugarNombre, setLugarNombre] = useState(null);
  const [data, setData] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [panelInfo, setPanelInfo] = useState(null);

  const [fecha, setFecha] = useState(hoyISO());
  const [desdeHora, setDesdeHora] = useState("19");
  const [hastaHora, setHastaHora] = useState("3");

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  async function fetchJSON(url) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error de red");
    return json;
  }

  async function calcularParaUbicacion(lat, lng) {
    setErrorMsg("");

    const rango = construirRangoFechaHora(fecha, desdeHora, hastaHora);
    if (rango.error) {
      setErrorMsg(rango.error);
      return;
    }

    setLoading(true);
    setData(null);
    setAdvice(null);

    const [weatherResult, solYLunaResult, bortleResult, lugarResult] = await Promise.allSettled([
      fetchJSON(`/api/weather?lat=${lat}&lon=${lng}&desde=${rango.desde.toISOString()}&hasta=${rango.hasta.toISOString()}`),
      fetchJSON(`/api/solyluna?lat=${lat}&lon=${lng}&fecha=${rango.desde.toISOString()}`),
      fetchJSON(`/api/bortle?lat=${lat}&lon=${lng}`),
      fetchJSON(`/api/lugar?lat=${lat}&lon=${lng}`),
    ]);

    if (weatherResult.status === "fulfilled") {
      const bloques = weatherResult.value;
      const promedio = bloques.reduce(
        (acc, item) => ({
          temp: acc.temp + item.temperatura / bloques.length,
          clouds: acc.clouds + item.nubosidad / bloques.length,
          humidity: acc.humidity + item.humedad / bloques.length,
          wind: acc.wind + item.viento / bloques.length,
        }),
        { temp: 0, clouds: 0, humidity: 0, wind: 0 }
      );

      const solLuna = solYLunaResult.status === "fulfilled" ? solYLunaResult.value : null;
      const bortleInfo = bortleResult.status === "fulfilled" ? bortleResult.value : { bortle: null, comentario: null };

      setData({ weather: promedio, solLuna, bortle: bortleInfo.bortle, bortleComentario: bortleInfo.comentario });
      setAdvice(generarConsejo(promedio, bortleInfo.bortle, solLuna?.iluminacionLunarPorc));
    } else {
      setErrorMsg(weatherResult.reason?.message || "No se pudo obtener el clima para este punto y horario.");
    }

    setLugarNombre(lugarResult.status === "fulfilled" ? lugarResult.value.nombre : null);
    setLoading(false);
  }

  function handleMapClick(latlng) {
    setCoords(latlng);
    calcularParaUbicacion(latlng.lat, latlng.lng);
  }

  function handleRecalcular() {
    if (!coords) {
      setErrorMsg("Primero elegí un lugar en el mapa o con el buscador.");
      return;
    }
    calcularParaUbicacion(coords.lat, coords.lng);
  }

  async function handleBuscar(e) {
    e.preventDefault();
    setErrorMsg("");
    if (busqueda.trim().length < 2) {
      setErrorMsg("Escribí al menos 2 caracteres para buscar.");
      return;
    }
    setBuscando(true);
    try {
      const resultados = await fetchJSON(`/api/buscar?q=${encodeURIComponent(busqueda)}`);
      if (resultados.length === 0) {
        setErrorMsg("No se encontraron lugares con ese nombre.");
      }
      setResultadosBusqueda(resultados);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBuscando(false);
    }
  }

  function elegirResultadoBusqueda(resultado) {
    const punto = { lat: resultado.lat, lng: resultado.lon };
    setCoords(punto);
    setCentrarEn({ lat: resultado.lat, lng: resultado.lon, ts: Date.now() });
    setResultadosBusqueda([]);
    setBusqueda(resultado.nombre);
    calcularParaUbicacion(resultado.lat, resultado.lon);
  }

  return (
    <div className="pagina" style={{ textAlign: "center" }}>
      <header>
        <img src="/logo.png" alt="Logo Astroturismo" className="logo" />
        <h1 className="titulo">Astroturismo Inteligente</h1>
        <p className="contacto">Contacto: info@astroturismo.com.ar</p>
        <nav className="nav-botones">
          {Object.entries(INFO_BOTONES).map(([clave, info]) => (
            <button
              key={clave}
              className="boton-naranja"
              onClick={() => setPanelInfo(panelInfo === clave ? null : clave)}
            >
              {info.titulo}
            </button>
          ))}
        </nav>
        {panelInfo && (
          <div className="panel-info">
            <p>{INFO_BOTONES[panelInfo].texto}</p>
          </div>
        )}
      </header>

      <form className="buscador" onSubmit={handleBuscar}>
        <label htmlFor="busqueda" className="etiqueta-buscador">
          Buscar ciudad, pueblo u observatorio:
        </label>
        <div className="buscador-fila">
          <input
            id="busqueda"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: El Chaltén, San Juan, La Palma, Atacama..."
          />
          <button type="submit" className="boton-naranja" disabled={buscando}>
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {resultadosBusqueda.length > 0 && (
          <ul className="resultados-busqueda">
            {resultadosBusqueda.map((r, i) => (
              <li key={i}>
                <button type="button" onClick={() => elegirResultadoBusqueda(r)}>
                  {r.nombre}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="fecha-hora">
        <label>
          Fecha:
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} min={hoyISO()} />
        </label>
        <label>
          Desde (hs):
          <input
            type="number"
            min="0"
            max="23"
            value={desdeHora}
            onChange={(e) => setDesdeHora(e.target.value)}
          />
        </label>
        <label>
          Hasta (hs):
          <input
            type="number"
            min="0"
            max="23"
            value={hastaHora}
            onChange={(e) => setHastaHora(e.target.value)}
          />
        </label>
        <button className="boton-naranja" onClick={handleRecalcular} disabled={!coords || loading}>
          Recalcular
        </button>
      </div>

      <p className="instrucciones">Hacé clic en el mapa (o buscá arriba) para ver el clima, sol/luna y contaminación lumínica del lugar.</p>

      <MapContainer center={[-34.6037, -58.3816]} zoom={5} className="leaflet-container">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationMarker posicion={coords} onSelect={handleMapClick} centrarEn={centrarEn} />
      </MapContainer>

      {loading && <p className="estado-carga">Cargando datos...</p>}
      {errorMsg && <p className="error-clima">{errorMsg}</p>}
      {coords && (
        <p className="coordenadas">
          Ubicación seleccionada: {lugarNombre ? <strong>{lugarNombre}</strong> : "nombre no disponible"} (
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
        </p>
      )}

      {data && <Results data={data} advice={advice} />}
    </div>
  );
}
