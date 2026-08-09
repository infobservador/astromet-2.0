// Evalúa condiciones de PELIGRO REAL para la seguridad de los turistas — no solo
// "cielo feo" o "molesto", sino situaciones donde lo más responsable es directamente
// reprogramar la excursión. Esto tiene prioridad absoluta sobre cualquier otra
// recomendación (incluida la de "hacer la actividad puertas adentro").
//
// Criterios (conservadores a propósito, mejor una alerta de más que un accidente):
// - 80% o más de probabilidad de lluvia o nieve.
// - Riesgo de tormenta eléctrica.
// - Nevada significativa (probabilidad considerable de nieve).
// - Viento peligroso (ráfagas fuertes, no solo "molesto").
// - Frío extremo combinado con viento (riesgo de hipotermia para un grupo al aire libre).
export function evaluarBanderaRoja(bloques) {
  if (!bloques || bloques.length === 0) return { banderaRoja: false, motivos: [] };

  const motivos = [];

  const probPrecipConDato = bloques
    .map((b) => b.probabilidadPrecipitacion)
    .filter((p) => p !== null && p !== undefined);
  const probPrecipMax = probPrecipConDato.length > 0 ? Math.max(...probPrecipConDato) : null;
  if (probPrecipMax !== null && probPrecipMax >= 80) {
    motivos.push(`probabilidad de precipitación de ${probPrecipMax.toFixed(0)}%`);
  }

  const hayTormenta = bloques.some((b) => b.condicion === "Thunderstorm");
  if (hayTormenta) {
    motivos.push("riesgo de tormenta eléctrica");
  }

  const hayNevadaSignificativa = bloques.some(
    (b) => b.condicion === "Snow" && (b.probabilidadPrecipitacion ?? 100) >= 60
  );
  if (hayNevadaSignificativa) {
    motivos.push("nevada significativa prevista");
  }

  const vientoMax = Math.max(...bloques.map((b) => b.viento));
  if (vientoMax > 15) {
    motivos.push(`viento peligroso (hasta ${vientoMax.toFixed(0)} m/s)`);
  }

  const hayFrioExtremo = bloques.some((b) => b.temperatura < -5 && b.viento > 8);
  if (hayFrioExtremo) {
    motivos.push("riesgo de hipotermia por frío extremo combinado con viento");
  }

  return { banderaRoja: motivos.length > 0, motivos };
}
