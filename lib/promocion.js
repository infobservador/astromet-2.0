// Período de lanzamiento: la descripción con IA es gratis para todos hasta esta
// fecha, sin necesitar código de operador. Después de esa fecha, la IA requiere
// un código con crédito disponible (el motor por reglas sigue siendo gratis siempre).
//
// Para cambiar la fecha o terminar la promo antes, solo hay que editar esta línea.
const FECHA_FIN_PROMO = "2026-08-31T23:59:59-03:00";

export function estaEnPeriodoDePrueba() {
  return Date.now() < Date.parse(FECHA_FIN_PROMO);
}

export function fechaFinPromoLegible() {
  return new Date(FECHA_FIN_PROMO).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}
