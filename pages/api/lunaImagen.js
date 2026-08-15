// Proxy a la API real de la NASA (Dial-A-Moon): devuelve la foto/render exacto de
// la Luna para la fecha/hora pedida (o "ahora" si no se especifica). Se usa como
// proxy propio para evitar problemas de CORS al pedirlo directo desde el navegador.
export default async function handler(req, res) {
  const fechaISO = req.query.fecha || new Date().toISOString();
  try {
    const r = await fetch(`https://svs.gsfc.nasa.gov/api/dialamoon/${fechaISO}`);
    if (!r.ok) throw new Error(`API respondió ${r.status}`);
    const data = await r.json();
    res.status(200).json({ url: data.image?.url || null });
  } catch (err) {
    console.error("Error obteniendo imagen de la luna:", err.message);
    res.status(200).json({ url: null });
  }
}
