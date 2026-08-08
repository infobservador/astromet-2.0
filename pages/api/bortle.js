import { brilloArtificialABortle, estimarBortlePorTipoDeLugar } from "../../lib/astro";
import { parsearCoordenadas } from "../../lib/validacion";

// Intenta primero el dato satelital real (World Atlas 2015 / NASA-NOAA VIIRS) vía
// lightpollutionmap.info, si hay una LIGHTPOLLUTION_KEY configurada. Si no hay
// clave, o el servicio falla, cae automáticamente en la estimación por tipo de
// lugar (más aproximada, pero no depende de ningún servicio externo con clave).
async function consultarDatoSatelital(lat, lon) {
  const key = process.env.LIGHTPOLLUTION_KEY;
  if (!key) return null;

  // Importante: este servicio espera las coordenadas como "longitud,latitud".
  const url = `https://www.lightpollutionmap.info/QueryRaster/?ql=wa_2015&qt=point&qd=${lon},${lat}&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`lightpollutionmap.info respondió ${r.status}`);

  const texto = (await r.text()).trim();

  // La documentación no fija un único formato estricto de respuesta para "point";
  // probamos JSON primero, y si no, interpretamos como CSV/texto plano con el
  // valor numérico (a veces solo el número, a veces "lon,lat,valor").
  let valor;
  try {
    const json = JSON.parse(texto);
    valor = typeof json === "number" ? json : json.value ?? json.Value ?? json.result ?? null;
  } catch {
    const partes = texto.split(",");
    valor = parseFloat(partes[partes.length - 1]);
  }

  if (valor === null || valor === undefined || isNaN(valor)) {
    throw new Error(`Respuesta inesperada de lightpollutionmap.info: "${texto}"`);
  }

  return valor; // brillo artificial en mcd/m²
}

export default async function handler(req, res) {
  const { lat: latRaw, lon: lonRaw } = req.query;

  const coords = parsearCoordenadas(latRaw, lonRaw);
  if (coords.error) return res.status(400).json({ error: coords.error });
  const { lat, lon } = coords;

  try {
    if (process.env.LIGHTPOLLUTION_KEY) {
      const brilloArtificial = await consultarDatoSatelital(parseFloat(lat), parseFloat(lon));

      if (brilloArtificial !== null) {
        const { bortle, sqm } = brilloArtificialABortle(brilloArtificial);
        return res.status(200).json({
          bortle,
          comentario: `Estimado con datos satelitales reales (World Atlas 2015, NASA/NOAA VIIRS). SQM: ${sqm} mag/arcsec².`,
          fuente: "satelital",
        });
      }
    }
  } catch (err) {
    console.error("Error consultando dato satelital de contaminación lumínica:", err.message);
    // Sigue de largo al respaldo por tipo de lugar.
  }

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`,
      { headers: { "User-Agent": "AstroturismoInteligente/1.0 (info@astroturismo.com.ar)" } }
    );
    const data = r.ok ? await r.json() : null;
    const { bortle, comentario } = estimarBortlePorTipoDeLugar(data?.address);
    res.status(200).json({ bortle, comentario, fuente: "estimado" });
  } catch (err) {
    console.error("Error estimando contaminación lumínica:", err.message);
    res.status(200).json({
      bortle: null,
      comentario: "No se pudo estimar la contaminación lumínica para este punto.",
      fuente: null,
    });
  }
}
