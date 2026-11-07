import { solYLuna } from "../../lib/astro";

export default function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Faltan parámetros lat y lon" });
  }

  try {
    const datos = solYLuna(parseFloat(lat), parseFloat(lon));
    res.status(200).json(datos);
  } catch (err) {
    console.error("Error calculando sol/luna:", err.message);
    res.status(500).json({ error: "No se pudieron calcular los horarios de sol y luna" });
  }
}
