// Combina dos pronósticos independientes para un resultado más robusto:
// - OpenWeather: bloques de 3 horas, hasta 5 días. Requiere OPENWEATHER_KEY.
// - Open-Meteo: datos por hora, hasta 16 días, SIN necesidad de clave/registro.
// Si ambos responden, se promedian entre sí. Si solo uno responde (por ejemplo,
// una fecha a más de 5 días donde OpenWeather ya no tiene datos), se usa el que
// esté disponible, y se informa qué fuente(s) se usaron.

async function consultarOpenWeather(lat, lon, desdeMs, hastaMs) {
  const apiKey = process.env.OPENWEATHER_KEY;
  if (!apiKey) return null;

  const r = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`
  );
  if (!r.ok) throw new Error(`OpenWeather respondió ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data.list)) return null;

  const bloques = data.list
    .filter((item) => item.dt * 1000 >= desdeMs && item.dt * 1000 <= hastaMs)
    .map((item) => ({
      hora: item.dt_txt,
      temperatura: item.main.temp,
      nubosidad: item.clouds.all,
      humedad: item.main.humidity,
      viento: item.wind.speed,
      condicion: item.weather?.[0]?.main || null,
      fuente: "OpenWeather",
    }));

  return bloques.length > 0 ? bloques : null;
}

async function consultarOpenMeteo(lat, lon, desdeMs, hastaMs) {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,cloudcover,relative_humidity_2m,wind_speed_10m` +
      `&wind_speed_unit=ms&timezone=UTC&forecast_days=16`
  );
  if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
  const data = await r.json();
  if (!data.hourly || !Array.isArray(data.hourly.time)) return null;

  const bloques = [];
  for (let i = 0; i < data.hourly.time.length; i++) {
    const t = Date.parse(data.hourly.time[i] + "Z");
    if (t >= desdeMs && t <= hastaMs) {
      bloques.push({
        hora: data.hourly.time[i],
        temperatura: data.hourly.temperature_2m[i],
        nubosidad: data.hourly.cloudcover[i],
        humedad: data.hourly.relative_humidity_2m[i],
        viento: data.hourly.wind_speed_10m[i],
        condicion: null,
        fuente: "Open-Meteo",
      });
    }
  }

  return bloques.length > 0 ? bloques : null;
}

function promediar(bloques) {
  return bloques.reduce(
    (acc, b) => ({
      temp: acc.temp + b.temperatura / bloques.length,
      clouds: acc.clouds + b.nubosidad / bloques.length,
      humidity: acc.humidity + b.humedad / bloques.length,
      wind: acc.wind + b.viento / bloques.length,
    }),
    { temp: 0, clouds: 0, humidity: 0, wind: 0 }
  );
}

export default async function handler(req, res) {
  const { parsearCoordenadas } = require("../../lib/validacion");
  const { lat: latRaw, lon: lonRaw, desde, hasta } = req.query;

  const coords = parsearCoordenadas(latRaw, lonRaw);
  if (coords.error) return res.status(400).json({ error: coords.error });
  const { lat, lon } = coords;

  let desdeMs, hastaMs;
  if (desde && hasta) {
    desdeMs = Date.parse(desde);
    hastaMs = Date.parse(hasta);
    if (isNaN(desdeMs) || isNaN(hastaMs) || hastaMs <= desdeMs) {
      return res.status(400).json({ error: "Rango de fecha/hora inválido." });
    }
    // Defensa adicional por si alguien arma la URL a mano (el formulario ya limita a
    // 15 días hacia adelante y no permite fechas pasadas, pero esto protege la API
    // igual si se la llama directo).
    const ahoraMs = Date.now();
    if (desdeMs < ahoraMs - 2 * 24 * 60 * 60 * 1000 || desdeMs > ahoraMs + 20 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "La fecha está fuera del rango permitido." });
    }
  } else {
    desdeMs = Date.now();
    hastaMs = desdeMs + 6 * 60 * 60 * 1000;
  }

  const resultados = await Promise.allSettled([
    consultarOpenWeather(lat, lon, desdeMs, hastaMs),
    consultarOpenMeteo(lat, lon, desdeMs, hastaMs),
  ]);

  resultados.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Error consultando fuente de clima #${i}:`, r.reason?.message);
    }
  });

  const bloquesOpenWeather = resultados[0].status === "fulfilled" ? resultados[0].value : null;
  const bloquesOpenMeteo = resultados[1].status === "fulfilled" ? resultados[1].value : null;

  if (!bloquesOpenWeather && !bloquesOpenMeteo) {
    return res.status(422).json({
      error:
        "No hay pronóstico disponible para esa fecha/hora en ninguna de las fuentes consultadas. " +
        "OpenWeather llega hasta 5 días hacia adelante, y Open-Meteo hasta 16 días.",
    });
  }

  const fuentesUsadas = [];
  const promedios = [];

  if (bloquesOpenWeather) {
    fuentesUsadas.push("OpenWeather");
    promedios.push(promediar(bloquesOpenWeather));
  }
  if (bloquesOpenMeteo) {
    fuentesUsadas.push("Open-Meteo");
    promedios.push(promediar(bloquesOpenMeteo));
  }

  const promedioCombinado = {
    temp: promedios.reduce((a, p) => a + p.temp, 0) / promedios.length,
    clouds: promedios.reduce((a, p) => a + p.clouds, 0) / promedios.length,
    humidity: promedios.reduce((a, p) => a + p.humidity, 0) / promedios.length,
    wind: promedios.reduce((a, p) => a + p.wind, 0) / promedios.length,
  };

  // Para detectar tramos horarios (nubosidad por franja) usamos los bloques con
  // mejor resolución temporal disponible: Open-Meteo (por hora) si está, si no
  // OpenWeather (cada 3 horas).
  const bloquesParaAnalisis = bloquesOpenMeteo || bloquesOpenWeather;

  res.status(200).json({
    bloques: bloquesParaAnalisis,
    promedio: promedioCombinado,
    fuentes: fuentesUsadas,
  });
}
