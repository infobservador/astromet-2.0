import { astroData, climaData, comentarioNoche } from "../../lib/astro";

export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const bortle = await astroData(lat, lon);
  const clima = await climaData(lat, lon);
  const comentario = comentarioNoche(bortle.bortle, clima);
  res.status(200).json({ comentario });
}
