// lib/astro.js
// Funciones de backend: contaminación lumínica (Bortle), clima, sol/luna y consejo.

const SunCalc = require("suncalc");

// --- Bortle (contaminación lumínica) ---
// NOTA: no hay todavía un endpoint real de la NASA conectado. Esta función
// falla "silenciosamente" (devuelve bortle: null) en vez de tirar abajo
// la ruta entera, hasta que integres un servicio real (ej. lightpollutionmap.info API).
async function getRadiance(lat, lon) {
  const token = process.env.NASA_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      `https://REEMPLAZAR-CON-ENDPOINT-REAL/viirs/vnp46a4?lat=${lat}&lon=${lon}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.radiance ?? null;
  } catch (err) {
    console.error("Error obteniendo radiancia:", err.message);
    return null;
  }
}

function radianceToBortle(r) {
  if (r === null || r === undefined) return null;
  if (r < 0.25) return 1;
  if (r < 1) return 2;
  if (r < 5) return 3;
  if (r < 20) return 4;
  if (r < 50) return 5;
  if (r < 100) return 6;
  if (r < 200) return 7;
  if (r < 500) return 8;
  return 9;
}

async function astroData(lat, lon) {
  const radiance = await getRadiance(lat, lon);
  return { lat, lon, bortle: radianceToBortle(radiance) };
}

// --- Clima (punto único, usado por /api/comentario) ---
async function climaData(lat, lon) {
  const key = process.env.OPENWEATHER_KEY;
  if (!key) throw new Error("Falta configurar OPENWEATHER_KEY en el servidor (.env.local)");

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=es`
  );
  if (!res.ok) throw new Error(`OpenWeather respondió ${res.status}`);
  return await res.json();
}

// --- Sol y Luna ---
// IMPORTANTE: antes esto pedía "moonrise"/"moonset" a sunrise-sunset.org, pero esa API
// NO devuelve datos de luna (solo de sol) — ese campo siempre venía undefined.
// Ahora se calcula todo localmente con SunCalc, que sí tiene datos solares Y lunares,
// y de paso agrega el horario de "noche astronómica" (cuando el cielo está realmente
// oscuro), que es el dato más importante para planificar observación astronómica.
function solYLuna(lat, lon, fecha = new Date()) {
  const sol = SunCalc.getTimes(fecha, lat, lon);
  const luna = SunCalc.getMoonTimes(fecha, lat, lon);
  const iluminacion = SunCalc.getMoonIllumination(fecha);

  return {
    salidaSol: sol.sunrise,
    puestaSol: sol.sunset,
    inicioNocheAstronomica: sol.night, // a partir de acá el cielo está totalmente oscuro
    finNocheAstronomica: sol.nightEnd,
    salidaLuna: luna.rise ?? null,
    puestaLuna: luna.set ?? null,
    lunaSiempreArriba: !!luna.alwaysUp,
    lunaSiempreAbajo: !!luna.alwaysDown,
    iluminacionLunarPorc: Math.round(iluminacion.fraction * 100), // 0-100, cuanto más alto, más molesta para ver el cielo profundo
  };
}

// --- Comentario nocturno (usado por /api/comentario) ---
function comentarioNoche(bortle, clima) {
  const condicion = clima?.weather?.[0]?.main;
  if (!condicion) return "No hay suficientes datos para generar un consejo.";
  if (bortle !== null && bortle <= 3 && condicion === "Clear") {
    return "Noche excelente para observar estrellas.";
  }
  if (bortle !== null && bortle > 6) {
    return "La contaminación lumínica es alta, mejor usar telescopio.";
  }
  if (condicion.includes("Cloud")) {
    return "Las nubes dificultarán la observación.";
  }
  return "Condiciones aceptables, pero revisá el pronóstico detallado.";
}

module.exports = { astroData, climaData, solYLuna, comentarioNoche };
