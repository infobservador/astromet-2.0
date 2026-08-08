// Búsqueda por texto (geocodificación directa): "El Chaltén" -> coordenadas.
export default async function handler(req, res) {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Escribí al menos 2 caracteres para buscar." });
  }
  if (q.length > 200) {
    return res.status(400).json({ error: "El texto de búsqueda es demasiado largo." });
  }

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
      { headers: { "User-Agent": "AstroturismoInteligente/1.0 (info@astroturismo.com.ar)" } }
    );

    if (!r.ok) throw new Error(`Nominatim respondió ${r.status}`);
    const data = await r.json();

    const resultados = data.map((item) => ({
      nombre: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));

    res.status(200).json(resultados);
  } catch (err) {
    console.error("Error buscando lugar:", err.message);
    res.status(500).json({ error: "No se pudo buscar ese lugar. Probá de nuevo en un momento." });
  }
}
