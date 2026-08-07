import { climaData } from "../../lib/astro";

export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const datos = await climaData(lat, lon);
  res.status(200).json(datos);
}
