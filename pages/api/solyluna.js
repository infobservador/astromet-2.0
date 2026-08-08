import { solYLuna } from "../../lib/astro";
import { parsearCoordenadas } from "../../lib/validacion";

export default function handler(req, res) {
  const { lat: latRaw, lon: lonRaw, fecha } = req.query;

  const coords = parsearCoordenadas(latRaw, lonRaw);
  if (coords.error) return res.status(400).json({ error: coords.error });

  try {
    const fechaCalculo = fecha ? new Date(fecha) : new Date();
    if (isNaN(fechaCalculo.getTime())) {
      return res.status(400).json({ error: "Fecha inválida." });
    }
    const anio = fechaCalculo.getFullYear();
    if (anio < 2020 || anio > 2100) {
      return res.status(400).json({ error: "El año de la fecha no es válido." });
    }
    const datos = solYLuna(coords.lat, coords.lon, fechaCalculo);
    res.status(200).json(datos);
  } catch (err) {
    console.error("Error calculando sol/luna:", err.message);
    res.status(500).json({ error: "No se pudieron calcular los horarios de sol y luna" });
  }
}
