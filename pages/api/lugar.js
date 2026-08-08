// Geocodificación inversa: coordenadas -> nombre del lugar.
// Usa Nominatim (OpenStreetMap), gratuito. Se llama desde el servidor (no desde
// el navegador) porque Nominatim exige identificar la app con un User-Agent.
export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Faltan parámetros lat y lon" });
  }

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      { headers: { "User-Agent": "AstroturismoInteligente/1.0 (info@astroturismo.com.ar)" } }
    );

    if (!r.ok) throw new Error(`Nominatim respondió ${r.status}`);
    const data = await r.json();

    res.status(200).json({
      nombre: data.display_name || null,
      address: data.address || {},
    });
  } catch (err) {
    console.error("Error en geocodificación inversa:", err.message);
    // Devolvemos 200 con nombre null: que falle esto no debe romper el resto de la app.
    res.status(200).json({ nombre: null, address: {} });
  }
}
