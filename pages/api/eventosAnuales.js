import { eventosAnualesDelLugar } from "../../lib/eventosAnuales";
import { parsearCoordenadas } from "../../lib/validacion";

export default function handler(req, res) {
  const { lat: latRaw, lon: lonRaw } = req.query;

  const coords = parsearCoordenadas(latRaw, lonRaw);
  if (coords.error) return res.status(400).json({ error: coords.error });

  const anioActual = new Date().getFullYear();

  try {
    const eventos = eventosAnualesDelLugar(coords.lat, coords.lon, anioActual, 2);
    res.status(200).json({ eventos, anioInicio: anioActual, anioFin: anioActual + 1 });
  } catch (err) {
    console.error("Error calculando eventos anuales:", err.message);
    res.status(500).json({ error: "No se pudieron calcular los eventos del año. Probá de nuevo en un momento." });
  }
}
