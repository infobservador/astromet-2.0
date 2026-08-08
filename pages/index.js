import dynamic from "next/dynamic";
import { useState } from "react";
import Results from "../components/Results";
import { generarDescripcionNoche } from "../lib/descripcionNoche";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const LocationMarker = dynamic(() => import("../components/LocationMarker"), { ssr: false });

const INFO_DESCRIPCION = {
  titulo: "Descripción",
  texto:
    "Astroturismo Inteligente es una herramienta pensada para operadores turísticos, guías y observadores que necesitan decidir, con anticipación, si un lugar y una franja horaria determinados son aptos para una experiencia de observación astronómica. " +
    "En lugar de mostrar datos sueltos, la aplicación los combina: pronóstico del clima hora por hora (temperatura, nubosidad, humedad y viento), horarios exactos de salida y puesta del sol y la luna, el inicio y fin de la noche astronómica (el momento en que el cielo queda completamente oscuro), la fase e iluminación lunar, y una estimación de la contaminación lumínica del lugar (escala de Bortle). " +
    "Con toda esa información, genera una descripción de la noche redactada específicamente para programar actividades de astroturismo: identifica tramos horarios problemáticos (por nubosidad, viento, humedad o exceso de luz lunar) y sugiere cómo adaptar la propuesta en cada caso, ya sea reforzando la observación de cielo profundo cuando las condiciones son óptimas, reorientando hacia la Luna y los planetas cuando el cielo no acompaña del todo, o proponiendo actividades alternativas (charlas, realidad aumentada o virtual, catas de productos regionales) cuando las condiciones desaconsejan la observación al aire libre.",
};

const INFO_BOTONES_FOOTER = {
  quienes: {
    titulo: "Quiénes somos",
    texto:
      "Somos el Instituto Latinoamericano de Astroturismo, una organización dedicada a promover la observación del cielo nocturno como una actividad turística, educativa y cultural en América Latina. " +
      "Trabajamos junto a operadores turísticos, guías de montaña, complejos astronómicos, reservas naturales y comunidades locales para desarrollar experiencias de astroturismo responsables, que combinan rigor científico con la riqueza cultural y mitológica de cada región. " +
      "Esta aplicación es una de nuestras herramientas de apoyo a la planificación: busca ayudar a quienes organizan estas experiencias a tomar mejores decisiones sobre cuándo y cómo llevarlas a cabo, cuidando tanto la calidad de la observación como el equipo utilizado. " +
      "Para consultas, alianzas institucionales o más información sobre nuestro trabajo, podés escribirnos a info@astroturismo.com.ar.",
  },
  precision: {
    titulo: "Fuentes y precisión técnica",
    texto:
      "Clima: se utiliza el pronóstico de OpenWeather, con bloques de 3 horas y un horizonte máximo de 5 días hacia adelante (más allá de eso no hay datos disponibles, y la aplicación lo indica). " +
      "Sol y luna: los horarios de salida, puesta, inicio y fin de la noche astronómica, y la posición/fase lunar, se calculan matemáticamente con la librería SunCalc, que tiene alta precisión astronómica y no depende de ningún servicio externo. " +
      "Contaminación lumínica (escala de Bortle): cuando está disponible, se utiliza el World Atlas 2015 (Falchi et al.), un estudio científico basado en datos satelitales reales de los sensores VIIRS de NASA/NOAA, consultado a través del servicio lightpollutionmap.info. " +
      "Cuando ese servicio no está configurado o no responde, se utiliza en su lugar una ESTIMACIÓN aproximada según el tipo de lugar (ciudad, pueblo, zona rural o área protegida), que no proviene de mediciones satelitales y debe tomarse solo como una referencia general. " +
      "El resultado siempre indica explícitamente de cuál de las dos fuentes proviene el valor mostrado. " +
      "Nombre del lugar: se obtiene por geocodificación inversa a través de OpenStreetMap/Nominatim, un servicio colaborativo y gratuito que puede no tener nombres precisos en zonas muy despobladas o rurales. " +
      "Recomendación general: toda la información brindada por la aplicación es una ayuda para la planificación, no un reemplazo del criterio profesional del guía u operador en el momento de la actividad.",
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
  const [descripcionNoche, setDescripcionNoche] = useState(null);
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
    setDescripcionNoche(null);

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
      setDescripcionNoche(generarDescripcionNoche(bloques, solLuna, bortleInfo, rango.desde));
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
    <div className="pagina" style={{ textAlign: "center" }} onClick={() => setPanelInfo(null)}>
      <header>
        <img src="/logo.png" alt="Logo Astroturismo" className="logo" />
        <h1 className="titulo">Astroturismo Inteligente</h1>
        <p className="contacto">Contacto: info@astroturismo.com.ar</p>
        <nav className="nav-botones">
          <button
            className="boton-naranja"
            onClick={(e) => {
              e.stopPropagation();
              setPanelInfo(panelInfo === "descripcion" ? null : "descripcion");
            }}
          >
            {INFO_DESCRIPCION.titulo}
          </button>
        </nav>
        {panelInfo === "descripcion" && (
          <div className="panel-info" onClick={(e) => e.stopPropagation()}>
            <p>{INFO_DESCRIPCION.texto}</p>
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

      {data && <Results data={data} advice={advice} descripcionNoche={descripcionNoche} />}

      <footer className="pie-pagina">
        <nav className="nav-botones">
          {Object.entries(INFO_BOTONES_FOOTER).map(([clave, info]) => (
            <button
              key={clave}
              className="boton-naranja"
              onClick={(e) => {
                e.stopPropagation();
                setPanelInfo(panelInfo === clave ? null : clave);
              }}
            >
              {info.titulo}
            </button>
          ))}
        </nav>
        {(panelInfo === "quienes" || panelInfo === "precision") && (
          <div className="panel-info" onClick={(e) => e.stopPropagation()}>
            <p>{INFO_BOTONES_FOOTER[panelInfo].texto}</p>
          </div>
        )}
      </footer>
    </div>
  );
}
