// Panel de administración de operadores (créditos). Protegido con sesión (cookie
// httpOnly creada al iniciar sesión en /admin), no con la clave directa en cada
// pedido — ver lib/adminAuth.js y pages/api/admin/login.js.
import { guardarOperador, listarOperadores, eliminarOperador } from "../../../lib/creditos";
import { autenticadoPorSesion } from "../../../lib/adminMiddleware";

export default async function handler(req, res) {
  if (!(await autenticadoPorSesion(req))) {
    return res.status(401).json({ error: "Sesión inválida o expirada. Volvé a iniciar sesión en /admin." });
  }

  try {
    if (req.method === "GET") {
      const operadores = await listarOperadores();
      return res.status(200).json(operadores);
    }

    if (req.method === "POST") {
      const { codigo, nombre, creditos } = req.body || {};
      if (!codigo || !/^[a-zA-Z0-9-]{3,20}$/.test(codigo)) {
        return res.status(400).json({ error: "El código debe tener entre 3 y 20 caracteres (letras, números, guiones)." });
      }
      const operador = await guardarOperador(codigo, nombre, creditos);
      return res.status(200).json({ codigo, ...operador });
    }

    if (req.method === "DELETE") {
      const { codigo } = req.body || {};
      if (!codigo) return res.status(400).json({ error: "Falta el código." });
      await eliminarOperador(codigo);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Método no permitido." });
  } catch (err) {
    console.error("Error en administración de operadores:", err.message);
    res.status(500).json({ error: err.message || "Error interno." });
  }
}
