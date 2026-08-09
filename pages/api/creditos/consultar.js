import { obtenerOperador } from "../../../lib/creditos";

export default async function handler(req, res) {
  const { codigo } = req.query;
  if (!codigo) return res.status(400).json({ error: "Falta el código de operador." });

  try {
    const operador = await obtenerOperador(codigo);
    if (!operador) return res.status(404).json({ error: "Código no encontrado." });
    res.status(200).json(operador);
  } catch (err) {
    console.error("Error consultando operador:", err.message);
    res.status(500).json({ error: "No se pudo consultar el saldo en este momento." });
  }
}
