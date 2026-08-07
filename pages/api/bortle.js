import { astroData } from "../../lib/astro";

export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Faltan parámetros lat y lon" });
  }

  try {
    const datos = await astroData(parseFloat(lat), parseFloat(lon));
    res.status(200).json(datos);
  } catch (err) {
    console.error("Error calculando contaminación lumínica:", err.message);
    res.status(500).json({ error: "No se pudo calcular la contaminación lumínica" });
  }
}
