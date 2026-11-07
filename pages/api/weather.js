export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Faltan parámetros lat y lon" });
  }

  const apiKey = process.env.OPENWEATHER_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar OPENWEATHER_KEY en el servidor" });
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `OpenWeather respondió ${response.status}` });
    }

    const data = await response.json();

    if (!Array.isArray(data.list)) {
      return res.status(502).json({ error: "Respuesta inesperada de OpenWeather" });
    }

    // Tomamos solo los próximos 5 pronósticos (cada uno cubre 3 horas)
    const forecast = data.list.slice(0, 5).map((item) => ({
      hora: item.dt_txt,
      temperatura: item.main.temp,
      nubosidad: item.clouds.all,
      humedad: item.main.humidity,
      viento: item.wind.speed,
    }));

    res.status(200).json(forecast);
  } catch (err) {
    console.error("Error consultando el clima:", err.message);
    res.status(500).json({ error: "No se pudo obtener el clima" });
  }
}
