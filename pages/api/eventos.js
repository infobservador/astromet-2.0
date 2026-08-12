import { eventosCelestesDelDia } from "../../lib/eventosCelestes";
import { parsearCoordenadas } from "../../lib/validacion";

export default function handler(req, res) {
  const { lat: latRaw, lon: lonRaw, fecha } = req.query;

  const coords = parsearCoordenadas(latRaw, lonRaw);
  if (coords.error) {
    // No debe romper el resto de la app: si las coordenadas fallan, no hay eventos.
    return res.status(200).json({ lluviasMeteoros: [], conjunciones: [], eclipses: [] });
  }

  try {
    const fechaCalculo = fecha ? new Date(fecha) : new Date();
    if (isNaN(fechaCalculo.getTime())) {
      return res.status(200).json({ lluviasMeteoros: [], conjunciones: [], eclipses: [] });
    }
    const eventos = eventosCelestesDelDia(fechaCalculo, coords.lat, coords.lon);
    res.status(200).json(eventos);
  } catch (err) {
    console.error("Error calculando eventos celestes:", err.message);
    res.status(200).json({ lluviasMeteoros: [], conjunciones: [], eclipses: [] });
  }
}
