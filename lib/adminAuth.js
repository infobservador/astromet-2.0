// Autenticación del panel /admin, mejorada respecto a "comparar la clave en texto
// plano en cada pedido":
// - Límite de intentos fallidos (con Redis), para frenar ataques de fuerza bruta.
// - Comparación resistente a "timing attacks" (crypto.timingSafeEqual).
// - Sesión con token aleatorio guardado en Redis + cookie httpOnly, en vez de
//   reenviar la clave real en cada pedido al servidor.
const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

const MAX_INTENTOS = 5;
const VENTANA_BLOQUEO_SEGUNDOS = 15 * 60; // 15 minutos
const DURACION_SESION_SEGUNDOS = 4 * 60 * 60; // 4 horas

function obtenerCliente() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false; // igual, no filtra tiempo útil (longitud no es secreta)
  return crypto.timingSafeEqual(bufA, bufB);
}

async function intentosBloqueados(ip) {
  const redis = obtenerCliente();
  if (!redis) return false; // sin Redis conectado, no se puede llevar el conteo
  const intentos = await redis.get(`admin_intentos:${ip}`);
  return (intentos || 0) >= MAX_INTENTOS;
}

async function registrarIntentoFallido(ip) {
  const redis = obtenerCliente();
  if (!redis) return;
  const clave = `admin_intentos:${ip}`;
  const nuevo = await redis.incr(clave);
  if (nuevo === 1) await redis.expire(clave, VENTANA_BLOQUEO_SEGUNDOS);
}

async function limpiarIntentos(ip) {
  const redis = obtenerCliente();
  if (!redis) return;
  await redis.del(`admin_intentos:${ip}`);
}

async function crearSesion() {
  const redis = obtenerCliente();
  if (!redis) return null;
  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(`admin_sesion:${token}`, true, { ex: DURACION_SESION_SEGUNDOS });
  return token;
}

async function sesionValida(token) {
  if (!token) return false;
  const redis = obtenerCliente();
  if (!redis) return false;
  const existe = await redis.get(`admin_sesion:${token}`);
  return !!existe;
}

module.exports = {
  compararSeguro,
  intentosBloqueados,
  registrarIntentoFallido,
  limpiarIntentos,
  crearSesion,
  sesionValida,
};
