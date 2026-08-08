import { estimarBortle } from "../../lib/astro";

export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Faltan parámetros lat y lon" });
  }

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`,
      { headers: { "User-Agent": "AstroturismoInteligente/1.0 (info@astroturismo.com.ar)" } }
    );
    const data = r.ok ? await r.json() : null;
    const { bortle, comentario } = estimarBortle(data?.address);
    res.status(200).json({ bortle, comentario });
  } catch (err) {
    console.error("Error estimando contaminación lumínica:", err.message);
    res.status(200).json({ bortle: null, comentario: "No se pudo estimar la contaminación lumínica para este punto." });
  }
}
