// Geocodificación inversa: coordenadas -> nombre del lugar.
// Usa Nominatim (OpenStreetMap), gratuito. Se llama desde el servidor (no desde
// el navegador) porque Nominatim exige identificar la app con un User-Agent.
import { parsearCoordenadas } from "../../lib/validacion";

export default async function handler(req, res) {
  const { lat: latRaw, lon: lonRaw } = req.query;

  const coords = parsearCoordenadas(latRaw, lonRaw);
  if (coords.error) {
    // Esta ruta nunca debe romper la app: si las coordenadas son inválidas, devolvemos
    // "sin nombre" en vez de un error, ya que solo se usa para mostrar un dato extra.
    return res.status(200).json({ nombre: null, address: {} });
  }
  const { lat, lon } = coords;

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
