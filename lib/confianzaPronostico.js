// Nota de confianza según la anticipación de la consulta. Basado en pruebas reales
// (ver /admin → Verificación de pronóstico): más allá de 3 días, el error de
// nubosidad crece notablemente y el sesgo cambia de dirección según la región
// (en algunos lugares subestima la nubosidad, en otros la sobreestima) — no hay un
// patrón único corregible, así que en vez de "corregir" con datos insuficientes,
// se avisa la reducción real de confiabilidad.
export function notaConfianza(inicioVentana) {
  if (!inicioVentana) return null;
  const diasAdelante = (new Date(inicioVentana).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diasAdelante > 3) {
    return (
      "Nota sobre confiabilidad: esta consulta es a más de 3 días de anticipación. A esa distancia, la " +
      "precisión del pronóstico baja notablemente, sobre todo en nubosidad. Tomalo como una orientación " +
      "general, no como un dato definitivo, y volvé a consultar más cerca de la fecha para mayor precisión."
    );
  }
  return null;
}
