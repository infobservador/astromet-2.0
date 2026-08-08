// lib/astro.js
// Funciones de backend: contaminación lumínica (Bortle, estimado), sol/luna y consejo.

const SunCalc = require("suncalc");

// --- Contaminación lumínica (escala de Bortle) ---
// No tenemos acceso a datos satelitales reales (NASA VIIRS requiere integración
// y credenciales que no están disponibles todavía). En su lugar, estimamos un
// valor APROXIMADO según el tipo de lugar que devuelve OpenStreetMap: una
// ciudad tiene mucha más luz artificial que una zona rural o un área protegida.
// No es preciso al nivel de datos satelitales, pero da una idea razonable.
function estimarBortle(direccion) {
  if (!direccion) {
    return {
      bortle: null,
      comentario: "No se pudo estimar la contaminación lumínica para este punto (sin datos de ubicación).",
    };
  }

  if (direccion.city || direccion.municipality) {
    return { bortle: 8, comentario: "Zona urbana / ciudad: cielo con mucha contaminación lumínica (estimado)." };
  }
  if (direccion.town) {
    return { bortle: 6, comentario: "Pueblo o localidad mediana: contaminación lumínica moderada (estimado)." };
  }
  if (direccion.village) {
    return { bortle: 4, comentario: "Pueblo pequeño: cielo relativamente oscuro, buena observación (estimado)." };
  }
  if (direccion.hamlet || direccion.isolated_dwelling || direccion.farm) {
    return { bortle: 3, comentario: "Zona rural aislada: cielo oscuro, muy buena para observación (estimado)." };
  }
  if (direccion.protected_area || direccion.national_park || direccion.nature_reserve) {
    return { bortle: 2, comentario: "Área natural protegida: cielo muy oscuro, excelente para observación (estimado)." };
  }
  return {
    bortle: 3,
    comentario: "No se identificó población cercana: probablemente cielo oscuro (estimado, sin datos satelitales).",
  };
}

// --- Sol y Luna ---
// Calculado con SunCalc: sol, luna, % de iluminación lunar, e inicio/fin de la
// "noche astronómica" (cuando el cielo está totalmente oscuro).
function solYLuna(lat, lon, fecha = new Date()) {
  const sol = SunCalc.getTimes(fecha, lat, lon);
  const luna = SunCalc.getMoonTimes(fecha, lat, lon);
  const iluminacion = SunCalc.getMoonIllumination(fecha);

  return {
    salidaSol: sol.sunrise,
    puestaSol: sol.sunset,
    inicioNocheAstronomica: sol.night,
    finNocheAstronomica: sol.nightEnd,
    salidaLuna: luna.rise ?? null,
    puestaLuna: luna.set ?? null,
    lunaSiempreArriba: !!luna.alwaysUp,
    lunaSiempreAbajo: !!luna.alwaysDown,
    iluminacionLunarPorc: Math.round(iluminacion.fraction * 100),
  };
}

module.exports = { estimarBortle, solYLuna };
