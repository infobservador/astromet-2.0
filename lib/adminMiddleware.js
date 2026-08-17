const { sesionValida } = require("./adminAuth");

// Devuelve true si el pedido trae una sesión de /admin válida (cookie httpOnly).
// Reemplaza el chequeo anterior de "clave en el header en cada pedido".
async function autenticadoPorSesion(req) {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/admin_sesion=([a-f0-9]+)/);
  if (!match) return false;
  return await sesionValida(match[1]);
}

module.exports = { autenticadoPorSesion };
