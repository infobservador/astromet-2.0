const { compararSeguro, intentosBloqueados, registrarIntentoFallido, limpiarIntentos, crearSesion } = require("../../../lib/adminAuth");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!process.env.ADMIN_SECRET) return res.status(500).json({ error: "Falta configurar ADMIN_SECRET en el servidor." });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "desconocida";

  if (await intentosBloqueados(ip)) {
    return res.status(429).json({ error: "Demasiados intentos fallidos. Esperá 15 minutos y volvé a probar." });
  }

  const { clave } = req.body || {};
  if (!clave || !compararSeguro(clave, process.env.ADMIN_SECRET)) {
    await registrarIntentoFallido(ip);
    return res.status(401).json({ error: "Clave incorrecta." });
  }

  await limpiarIntentos(ip);
  const token = await crearSesion();
  if (!token) return res.status(500).json({ error: "No se pudo crear la sesión (falta la base de datos conectada)." });

  res.setHeader(
    "Set-Cookie",
    `admin_sesion=${token}; HttpOnly; Path=/; Max-Age=${4 * 60 * 60}; SameSite=Strict${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  res.status(200).json({ ok: true });
}
