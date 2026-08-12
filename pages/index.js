import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import Results from "../components/Results";
import Comparador from "../components/Comparador";
import { generarDescripcionNoche } from "../lib/descripcionNoche";
import { evaluarBanderaRoja } from "../lib/seguridad";
import { estaEnPeriodoDePrueba, fechaFinPromoLegible } from "../lib/promocion";
import { generarPdfReporte } from "../lib/generarPdf";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const LocationMarker = dynamic(() => import("../components/LocationMarker"), { ssr: false });

const INFO_DESCRIPCION = {
  titulo: "Descripción",
  texto:
    "Astroturismo Inteligente es una herramienta pensada para operadores turísticos, guías y observadores que necesitan decidir, con anticipación, si un lugar y una franja horaria determinados son aptos para una experiencia de observación astronómica. " +
    "En lugar de mostrar datos sueltos, la aplicación los combina: pronóstico del clima hora por hora (temperatura, nubosidad, humedad y viento), horarios exactos de salida y puesta del sol y la luna, el inicio y fin de la noche astronómica (el momento en que el cielo queda completamente oscuro), la fase e iluminación lunar, y una estimación de la contaminación lumínica del lugar (escala de Bortle). " +
    "Con toda esa información, genera una descripción de la noche redactada específicamente para programar actividades de astroturismo: identifica tramos horarios problemáticos (por nubosidad, viento, humedad o exceso de luz lunar) y sugiere cómo adaptar la propuesta en cada caso, ya sea reforzando la observación a simple vista y con binoculares de objetos brillantes (cúmulos, galaxias visibles, la Vía Láctea) cuando las condiciones son óptimas, reorientando hacia la Luna y los planetas cuando el cielo no acompaña del todo, o proponiendo actividades alternativas (mitología, realidad aumentada o virtual, catas de productos regionales) cuando las condiciones desaconsejan la observación al aire libre. El componente de mitología y cosmovisiones culturales está presente siempre, no solo como alternativa.",
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
      "Clima: se combinan dos pronósticos independientes para un resultado más robusto — OpenWeather (bloques de 3 horas, hasta 5 días hacia adelante) y Open-Meteo (datos por hora, hasta 16 días hacia adelante, sin necesidad de clave). Cuando ambos están disponibles para la fecha elegida, se promedian entre sí; si solo uno tiene datos para esa fecha (por ejemplo, más allá de los 5 días de OpenWeather), se usa el que esté disponible. La aplicación siempre indica qué fuente(s) se usaron. " +
      "Sol y luna: los horarios de salida, puesta, inicio y fin de la noche astronómica, y la posición/fase lunar, se calculan matemáticamente con la librería SunCalc, que tiene alta precisión astronómica y no depende de ningún servicio externo. " +
      "Contaminación lumínica (escala de Bortle): cuando está disponible, se utiliza el World Atlas 2015 (Falchi et al.), un estudio científico basado en datos satelitales reales de los sensores VIIRS de NASA/NOAA, consultado a través del servicio lightpollutionmap.info. " +
      "Cuando ese servicio no está configurado o no responde, se utiliza en su lugar una ESTIMACIÓN aproximada según el tipo de lugar (ciudad, pueblo, zona rural o área protegida), que no proviene de mediciones satelitales y debe tomarse solo como una referencia general. " +
      "El resultado siempre indica explícitamente de cuál de las dos fuentes proviene el valor mostrado. " +
      "Descripción de la noche: cuando está disponible, el texto lo redacta Claude (IA de Anthropic) a partir de los datos ya calculados por la aplicación (nunca inventa datos astronómicos que no estén en esos cálculos). Si la IA no está configurada, se usa en su lugar un generador local por reglas fijas. La aplicación siempre indica cuál de las dos fuentes se usó. " +
      "Nombre del lugar: se obtiene por geocodificación inversa a través de OpenStreetMap/Nominatim, un servicio colaborativo y gratuito que puede no tener nombres precisos en zonas muy despobladas o rurales. " +
      "Recomendación general: toda la información brindada por la aplicación es una ayuda para la planificación, no un reemplazo del criterio profesional del guía u operador en el momento de la actividad.",
  },
};

// Acepta solo enteros (con o sin signo "-"), rechaza decimales, texto, notación
// científica, vacíos, etc. — así "3.5", "3e1", "abc" o "" nunca pasan como hora válida.
function esEnteroValido(valor) {
  return /^-?\d+$/.test(String(valor).trim());
}

function construirRangoFechaHora(fecha, desdeHora, hastaHora) {
  if (!fecha) return { error: "Elegí una fecha." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "La fecha no tiene un formato válido." };

  const fechaBase = new Date(`${fecha}T00:00:00`);
  if (isNaN(fechaBase.getTime())) return { error: "La fecha elegida no es válida." };

  // Rechaza años absurdos aunque el formato sea correcto (ej: typos como "0002" o "9999").
  const anio = fechaBase.getFullYear();
  if (anio < 2020 || anio > 2100) return { error: "El año de la fecha no es válido." };

  if (!esEnteroValido(desdeHora)) return { error: "La hora 'Desde' debe ser un número entero, sin decimales ni texto." };
  if (!esEnteroValido(hastaHora)) return { error: "La hora 'Hasta' debe ser un número entero, sin decimales ni texto." };

  const desdeH = parseInt(desdeHora, 10);
  const hastaH = parseInt(hastaHora, 10);

  if (desdeH < 0 || desdeH > 23) return { error: "La hora 'Desde' debe estar entre 0 y 23." };
  if (hastaH < 0 || hastaH > 23) return { error: "La hora 'Hasta' debe estar entre 0 y 23." };

  const desde = new Date(`${fecha}T${String(desdeH).padStart(2, "0")}:00:00`);
  let hasta = new Date(`${fecha}T${String(hastaH).padStart(2, "0")}:00:00`);

  // Si "hasta" es igual o anterior a "desde", asumimos que cruza la medianoche (ej: 19hs a 3hs del otro día).
  if (hasta <= desde) {
    hasta = new Date(hasta.getTime() + 24 * 60 * 60 * 1000);
  }

  const ahora = new Date();

  // Ya pasó (con 3 hs de margen para no rechazar "esta noche" recién empezada).
  if (hasta < new Date(ahora.getTime() - 3 * 60 * 60 * 1000)) {
    return { error: "La fecha/hora elegida ya pasó." };
  }

  // Demasiado en el pasado (protege contra una fecha tipeada a mano, ej. "2020-01-01").
  const limiteMin = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  if (desde < limiteMin) {
    return { error: "Esa fecha ya pasó." };
  }

  // Demasiado en el futuro (límite real de los pronósticos disponibles: 15 días).
  const limiteMax = new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000);
  if (desde > limiteMax) {
    return { error: "Solo se puede pronosticar el clima hasta 15 días hacia adelante." };
  }

  return { desde, hasta };
}

function generarConsejo(clima, bortle, iluminacionLunarPorc, bloques) {
  // La seguridad tiene prioridad absoluta: si hay bandera roja, ni siquiera se
  // calcula el puntaje normal, se marca directamente como "Peligro".
  if (bloques) {
    const { banderaRoja, motivos } = evaluarBanderaRoja(bloques);
    if (banderaRoja) {
      return {
        nivel: "Peligro",
        texto: `Se recomienda reprogramar: ${motivos.join(", ")}.`,
        puntaje: -100,
        banderaRoja: true,
        motivosBanderaRoja: motivos,
      };
    }
  }

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

  if (puntaje >= 5) return { nivel: "Excelente", texto: "Excelente noche para observación astronómica.", puntaje };
  if (puntaje >= 3) {
    return {
      nivel: "Buena",
      texto: razones.length ? `Buena noche, con algunas limitaciones: ${razones.join(", ")}.` : "Buena noche para observar.",
      puntaje,
    };
  }
  return {
    nivel: "Regular",
    texto: razones.length ? `Condiciones difíciles: ${razones.join(", ")}.` : "Condiciones poco favorables esta noche.",
    puntaje,
  };
}

// Usa los componentes de fecha LOCALES del navegador, no UTC — toISOString() siempre
// da la fecha en UTC, lo que hacía que de noche en Argentina (UTC-3) la app pensara
// que ya era "mañana" y rechazara elegir el día de hoy en el selector de fecha.
function formatearFechaLocal(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hoyISO() {
  return formatearFechaLocal(new Date());
}

function maxFechaISO() {
  return formatearFechaLocal(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
}

export default function Home() {
  const [coords, setCoords] = useState(null);
  const [centrarEn, setCentrarEn] = useState(null);
  const [lugarNombre, setLugarNombre] = useState(null);
  const [data, setData] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [descripcionNoche, setDescripcionNoche] = useState(null);
  const [descripcionFuente, setDescripcionFuente] = useState(null);
  const [banderaRoja, setBanderaRoja] = useState(false);
  const [motivosBanderaRoja, setMotivosBanderaRoja] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [panelInfo, setPanelInfo] = useState(null);

  const [fecha, setFecha] = useState(hoyISO());
  const [desdeHora, setDesdeHora] = useState("19");
  const [hastaHora, setHastaHora] = useState("3");

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  const [favoritos, setFavoritos] = useState([]);
  const [codigoOperador, setCodigoOperador] = useState("");
  const [creditosRestantes, setCreditosRestantes] = useState(null);
  const [comparando, setComparando] = useState(false);
  const [cantidadNoches, setCantidadNoches] = useState("7");
  const [resultadosComparacion, setResultadosComparacion] = useState(null);

  // Carga los favoritos y el código de operador guardados en este navegador (localStorage).
  useEffect(() => {
    try {
      const guardados = window.localStorage.getItem("astroturismo_favoritos");
      if (guardados) setFavoritos(JSON.parse(guardados));
      const codigo = window.localStorage.getItem("astroturismo_codigo_operador");
      if (codigo) setCodigoOperador(codigo);
    } catch {
      // Si localStorage no está disponible o el dato es inválido, seguimos sin esos datos.
    }
  }, []);

  function handleGuardarCodigoOperador(codigo) {
    setCodigoOperador(codigo);
    try {
      if (codigo) window.localStorage.setItem("astroturismo_codigo_operador", codigo);
      else window.localStorage.removeItem("astroturismo_codigo_operador");
    } catch {
      // No es crítico si no se puede guardar.
    }
  }

  function guardarFavoritos(lista) {
    setFavoritos(lista);
    try {
      window.localStorage.setItem("astroturismo_favoritos", JSON.stringify(lista));
    } catch {
      // Si no se puede guardar (modo privado, storage lleno, etc.), no rompemos la app.
    }
  }

  const MAX_FAVORITOS = 12;

  function agregarFavorito() {
    if (!coords) return;
    const nombre = lugarNombre || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    const yaExiste = favoritos.some((f) => Math.abs(f.lat - coords.lat) < 0.0001 && Math.abs(f.lng - coords.lng) < 0.0001);
    if (yaExiste) return;

    let listaNueva = [...favoritos, { nombre, lat: coords.lat, lng: coords.lng }];
    // Si se llega al límite, se borra el más antiguo (el primero de la lista) para
    // hacer lugar al nuevo, así nunca hace falta borrar nada a mano ni la lista crece sin fin.
    if (listaNueva.length > MAX_FAVORITOS) {
      listaNueva = listaNueva.slice(listaNueva.length - MAX_FAVORITOS);
    }
    guardarFavoritos(listaNueva);
  }

  const esFavoritoActual =
    coords && favoritos.some((f) => Math.abs(f.lat - coords.lat) < 0.0001 && Math.abs(f.lng - coords.lng) < 0.0001);

  function eliminarFavorito(i) {
    guardarFavoritos(favoritos.filter((_, idx) => idx !== i));
  }

  function usarFavorito(fav) {
    const punto = { lat: fav.lat, lng: fav.lng };
    setCoords(punto);
    setCentrarEn({ lat: fav.lat, lng: fav.lng, ts: Date.now() });
    setLugarNombre(fav.nombre);
    calcularParaUbicacion(fav.lat, fav.lng);
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error de red");
    return json;
  }

  async function calcularParaUbicacion(lat, lng, fechaOverride) {
    setErrorMsg("");

    const fechaAUsar = fechaOverride || fecha;
    const rango = construirRangoFechaHora(fechaAUsar, desdeHora, hastaHora);
    if (rango.error) {
      setErrorMsg(rango.error);
      return;
    }

    setLoading(true);
    setData(null);
    setAdvice(null);
    setDescripcionNoche(null);
    setDescripcionFuente(null);
    setBanderaRoja(false);
    setMotivosBanderaRoja([]);

    const [weatherResult, solYLunaResult, bortleResult, lugarResult] = await Promise.allSettled([
      fetchJSON(`/api/weather?lat=${lat}&lon=${lng}&desde=${rango.desde.toISOString()}&hasta=${rango.hasta.toISOString()}`),
      fetchJSON(`/api/solyluna?lat=${lat}&lon=${lng}&fecha=${rango.desde.toISOString()}`),
      fetchJSON(`/api/bortle?lat=${lat}&lon=${lng}`),
      fetchJSON(`/api/lugar?lat=${lat}&lon=${lng}`),
    ]);

    if (weatherResult.status === "fulfilled") {
      const { bloques, promedio, fuentes } = weatherResult.value;

      const solLuna = solYLunaResult.status === "fulfilled" ? solYLunaResult.value : null;
      const bortleInfo = bortleResult.status === "fulfilled" ? bortleResult.value : { bortle: null, comentario: null };

      setData({
        weather: promedio,
        weatherFuentes: fuentes,
        solLuna,
        bortle: bortleInfo.bortle,
        bortleComentario: bortleInfo.comentario,
      });
      setAdvice(generarConsejo(promedio, bortleInfo.bortle, solLuna?.iluminacionLunarPorc, bloques));

      // La descripción de la noche se genera en el servidor (con IA si está configurada,
      // si no con el generador local por reglas). Si ni siquiera se puede llamar al
      // servidor (sin conexión, etc.), usamos el generador local directo como último respaldo.
      try {
        const respuesta = await fetchJSON("/api/generarDescripcion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lugarNombre,
            fecha: fechaAUsar,
            desdeHora,
            hastaHora,
            bloques,
            solLuna,
            bortleInfo,
            codigoOperador: codigoOperador || undefined,
          }),
        });
        setDescripcionNoche(respuesta.parrafos);
        setDescripcionFuente(respuesta.fuente);
        setBanderaRoja(respuesta.banderaRoja || false);
        setMotivosBanderaRoja(respuesta.motivosBanderaRoja || []);
        setCreditosRestantes(respuesta.creditosRestantes ?? null);
      } catch {
        const { banderaRoja: peligro, motivos } = evaluarBanderaRoja(bloques);
        setDescripcionNoche(generarDescripcionNoche(bloques, solLuna, bortleInfo, rango.desde));
        setDescripcionFuente("reglas");
        setBanderaRoja(peligro);
        setMotivosBanderaRoja(motivos);
      }
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

  async function handleComparar() {
    if (!coords) {
      setErrorMsg("Primero elegí un lugar en el mapa o con el buscador.");
      return;
    }

    const cantidad = parseInt(cantidadNoches, 10);
    if (isNaN(cantidad) || cantidad < 1 || cantidad > 15) {
      setErrorMsg("La cantidad de noches a comparar debe ser un número entre 1 y 15.");
      return;
    }

    setErrorMsg("");
    setComparando(true);
    setResultadosComparacion(null);

    let bortleInfo = { bortle: null, comentario: null };
    try {
      bortleInfo = await fetchJSON(`/api/bortle?lat=${coords.lat}&lon=${coords.lng}`);
    } catch {
      // Si falla, seguimos sin dato de Bortle en la comparación (no es crítico).
    }

    const noches = [];
    for (let i = 0; i < cantidad; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const fechaISO = d.toISOString().slice(0, 10);
      const rango = construirRangoFechaHora(fechaISO, desdeHora, hastaHora);
      if (rango.error) continue; // ej: el primer día ya pasó de horario, se salta

      try {
        const [weatherRes, solLunaRes] = await Promise.all([
          fetchJSON(`/api/weather?lat=${coords.lat}&lon=${coords.lng}&desde=${rango.desde.toISOString()}&hasta=${rango.hasta.toISOString()}`),
          fetchJSON(`/api/solyluna?lat=${coords.lat}&lon=${coords.lng}&fecha=${rango.desde.toISOString()}`),
        ]);
        const consejo = generarConsejo(weatherRes.promedio, bortleInfo.bortle, solLunaRes?.iluminacionLunarPorc, weatherRes.bloques);
        noches.push({ fecha: fechaISO, promedio: weatherRes.promedio, solLuna: solLunaRes, consejo });
      } catch {
        // Si una noche puntual falla (ej. fuera del rango de pronóstico), se salta esa sola.
      }
    }

    noches.sort((a, b) => b.consejo.puntaje - a.consejo.puntaje);
    setResultadosComparacion(noches);
    setComparando(false);

    if (noches.length === 0) {
      setErrorMsg("No se pudo calcular ninguna noche dentro del rango de pronóstico disponible.");
    }
  }

  function elegirFechaDesdeComparador(fechaISO) {
    setFecha(fechaISO);
    setResultadosComparacion(null);
    calcularParaUbicacion(coords.lat, coords.lng, fechaISO);
  }

  async function handleDescargarPdf() {
    if (!data) return;
    await generarPdfReporte({
      data,
      advice,
      descripcionNoche,
      lugarNombre,
      coords,
      fecha,
      desdeHora,
      hastaHora,
      banderaRoja,
      motivosBanderaRoja,
    });
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
        <img src="/logo-astromet.png" alt="Astromet 2.0" className="logo-astromet" />
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

      <div className="codigo-operador" onClick={(e) => e.stopPropagation()}>
        <label>
          Código de operador (opcional):
          <input
            type="text"
            value={codigoOperador}
            onChange={(e) => handleGuardarCodigoOperador(e.target.value.trim())}
            placeholder="No hace falta durante la promo de lanzamiento"
          />
        </label>
        {creditosRestantes !== null && <span className="creditos-restantes">Créditos disponibles: {creditosRestantes}</span>}
      </div>

      {estaEnPeriodoDePrueba() && (
        <p className="aviso-promo">
          🎁 Lanzamiento: la descripción de la noche generada con IA es gratis para todos hasta el {fechaFinPromoLegible()}.
          Después de esa fecha vas a necesitar un código de operador con crédito (el resto de la app sigue siendo gratis siempre).
        </p>
      )}

      <div className="fecha-hora">
        <label>
          Fecha:
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            min={hoyISO()}
            max={maxFechaISO()}
          />
        </label>
        <label>
          Desde (hs):
          <input
            type="number"
            min="0"
            max="23"
            step="1"
            inputMode="numeric"
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
            step="1"
            inputMode="numeric"
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
          <button
            className="boton-favorito"
            onClick={agregarFavorito}
            disabled={esFavoritoActual}
            title={esFavoritoActual ? "Ya está guardado en favoritos" : "Guardar como favorito"}
          >
            {esFavoritoActual ? "★ Guardado" : "☆ Guardar"}
          </button>
        </p>
      )}

      {favoritos.length > 0 && (
        <div className="favoritos-cerca" onClick={(e) => e.stopPropagation()}>
          <span className="favoritos-etiqueta">
            Tus lugares guardados ({favoritos.length}/{MAX_FAVORITOS}):
          </span>
          <div className="favoritos-cerca-lista">
            {favoritos.map((f, i) => (
              <span key={i} className="favorito-chip-cerca">
                <button type="button" onClick={() => usarFavorito(f)}>
                  📍 {f.nombre}
                </button>
                <button
                  type="button"
                  className="favorito-chip-cerca-quitar"
                  onClick={() => eliminarFavorito(i)}
                  aria-label="Quitar de favoritos"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {banderaRoja && data && (
        <div className="bandera-roja" role="alert">
          <div className="bandera-roja-titulo">🚩 Se recomienda reprogramar la excursión</div>
          <div className="bandera-roja-motivos">
            Condiciones de riesgo real para la seguridad de los turistas: {motivosBanderaRoja.join(", ")}.
          </div>
        </div>
      )}

      {data && (
        <div className="acciones-resultado">
          <button className="boton-naranja" onClick={handleDescargarPdf}>
            Descargar reporte en PDF
          </button>
        </div>
      )}

      {data && (
        <Results data={data} advice={advice} descripcionNoche={descripcionNoche} descripcionFuente={descripcionFuente} />
      )}

      <div className="comparador" onClick={(e) => e.stopPropagation()}>
        <h3>Comparar varias noches</h3>
        <p className="instrucciones">
          Compara el mismo horario ({desdeHora}hs a {hastaHora}hs) a lo largo de varias noches, para el lugar seleccionado, y las
          ordena de mejor a peor.
        </p>
        <div className="comparador-controles">
          <label>
            Cantidad de noches:
            <input
              type="number"
              min="1"
              max="15"
              step="1"
              inputMode="numeric"
              value={cantidadNoches}
              onChange={(e) => setCantidadNoches(e.target.value)}
            />
          </label>
          <button className="boton-naranja" onClick={handleComparar} disabled={!coords || comparando}>
            {comparando ? "Comparando..." : "Comparar"}
          </button>
        </div>
        {resultadosComparacion && <Comparador resultados={resultadosComparacion} onElegirFecha={elegirFechaDesdeComparador} />}
      </div>

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
