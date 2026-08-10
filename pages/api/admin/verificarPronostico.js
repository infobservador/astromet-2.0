import { verificarPronostico } from "../../../lib/verificacionPronostico";
import { parsearCoordenadas } from "../../../lib/validacion";

export default async function handler(req, res) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Clave de administrador incorrecta." });
  }

  const { lat, lon, dias } = req.query;
  const coords = parsearCoordenadas(lat, lon);
  if (coords.error) return res.status(400).json({ error: coords.error });

  const diasHaciaAtras = Math.min(Math.max(parseInt(dias, 10) || 10, 3), 30);

  try {
    const resultado = await verificarPronostico(coords.lat, coords.lon, diasHaciaAtras);
    res.status(200).json({ resultado, diasHaciaAtras });
  } catch (err) {
    console.error("Error verificando pronóstico:", err.message);
    res.status(500).json({ error: err.message || "No se pudo verificar el pronóstico." });
  }
}
