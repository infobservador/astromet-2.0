// lib/astro.js
// Funciones de backend: contaminación lumínica (Bortle), sol/luna y consejo.

const SunCalc = require("suncalc");

// --- Contaminación lumínica: conversión de brillo artificial a SQM y Bortle ---
// Fórmula publicada por lightpollutionmap.info (basada en el World Atlas 2015 de
// Falchi et al., datos satelitales NASA/NOAA VIIRS reales):
//   Brillo total = brillo_artificial(mcd/m²) + 0.171168465 (brillo natural del cielo)
//   SQM (mag/arcsec²) = log10(Brillo total / 108000000) / -0.4
// Después el SQM se traduce a la escala de Bortle con umbrales aproximados
// (la propia escala de Bortle es subjetiva por definición, así que esto ya es
// una aproximación aunque el dato de brillo de origen sea satelital real).
function brilloArtificialABortle(brilloArtificialMcdPorM2) {
  const brilloTotal = brilloArtificialMcdPorM2 + 0.171168465;
  const sqm = Math.log10(brilloTotal / 108000000) / -0.4;

  let bortle;
  if (sqm >= 21.75) bortle = 1;
  else if (sqm >= 21.6) bortle = 2;
  else if (sqm >= 21.3) bortle = 3;
  else if (sqm >= 20.8) bortle = 4;
  else if (sqm >= 20.3) bortle = 5;
  else if (sqm >= 19.5) bortle = 6;
  else if (sqm >= 18.5) bortle = 7;
  else if (sqm >= 18.0) bortle = 8;
  else bortle = 9;

  return { bortle, sqm: Math.round(sqm * 100) / 100 };
}

// --- Bortle estimado por tipo de lugar (respaldo, sin datos satelitales) ---
// Se usa cuando no hay LIGHTPOLLUTION_KEY configurada o el servicio satelital
// falla. Es una aproximación mucho más cruda que la de arriba, pero no depende
// de ningún servicio externo con clave.
function estimarBortlePorTipoDeLugar(direccion) {
  if (!direccion) {
    return {
      bortle: null,
      comentario: "No se pudo estimar la contaminación lumínica para este punto (sin datos de ubicación).",
    };
  }

  if (direccion.city || direccion.municipality) {
    return { bortle: 8, comentario: "Zona urbana / ciudad: cielo con mucha contaminación lumínica (estimado por tipo de lugar, sin datos satelitales)." };
  }
  if (direccion.town) {
    return { bortle: 6, comentario: "Pueblo o localidad mediana: contaminación lumínica moderada (estimado por tipo de lugar, sin datos satelitales)." };
  }
  if (direccion.village) {
    return { bortle: 4, comentario: "Pueblo pequeño: cielo relativamente oscuro (estimado por tipo de lugar, sin datos satelitales)." };
  }
  if (direccion.hamlet || direccion.isolated_dwelling || direccion.farm) {
    return { bortle: 3, comentario: "Zona rural aislada: cielo oscuro (estimado por tipo de lugar, sin datos satelitales)." };
  }
  if (direccion.protected_area || direccion.national_park || direccion.nature_reserve) {
    return { bortle: 2, comentario: "Área natural protegida: cielo muy oscuro (estimado por tipo de lugar, sin datos satelitales)." };
  }
  return {
    bortle: 3,
    comentario: "No se identificó población cercana: probablemente cielo oscuro (estimado por tipo de lugar, sin datos satelitales).",
  };
}

// --- Sol y Luna ---
// Calculado con SunCalc. Además de horarios de sol, calcula: altitud de la luna al
// inicio de la ventana elegida (para saber si está arriba y "cerca del cenit"), y el
// PRÓXIMO evento de salida/puesta de luna revisando también el día siguiente (la luna
// puede cruzar la medianoche del calendario, y SunCalc por defecto solo calcula
// eventos dentro del mismo día calendario que se le pasa).
function datosLuna(lat, lon, fecha) {
  const posicionInicio = SunCalc.getMoonPosition(fecha, lat, lon);
  const altitudInicioGrados = posicionInicio.altitude * (180 / Math.PI);
  const arribaAlInicio = altitudInicioGrados > 0;

  const diaActual = SunCalc.getMoonTimes(fecha, lat, lon);
  const diaSiguiente = SunCalc.getMoonTimes(new Date(fecha.getTime() + 24 * 60 * 60 * 1000), lat, lon);

  const esFuturo = (t) => t && t.getTime() > fecha.getTime();
  const candidatosSalida = [diaActual.rise, diaSiguiente.rise].filter(esFuturo).sort((a, b) => a - b);
  const candidatosPuesta = [diaActual.set, diaSiguiente.set].filter(esFuturo).sort((a, b) => a - b);

  return {
    altitudInicioGrados: Math.round(altitudInicioGrados),
    arribaAlInicio,
    proximaSalida: candidatosSalida[0] || null,
    proximaPuesta: candidatosPuesta[0] || null,
    lunaSiempreArriba: !!diaActual.alwaysUp,
    lunaSiempreAbajo: !!diaActual.alwaysDown,
  };
}

function solYLuna(lat, lon, fecha = new Date()) {
  const sol = SunCalc.getTimes(fecha, lat, lon);
  const luna = datosLuna(lat, lon, fecha);
  const iluminacion = SunCalc.getMoonIllumination(fecha);

  return {
    salidaSol: sol.sunrise,
    puestaSol: sol.sunset,
    inicioNocheAstronomica: sol.night,
    finNocheAstronomica: sol.nightEnd,
    salidaLuna: luna.proximaSalida,
    puestaLuna: luna.proximaPuesta,
    lunaSiempreArriba: luna.lunaSiempreArriba,
    lunaSiempreAbajo: luna.lunaSiempreAbajo,
    lunaArribaAlInicio: luna.arribaAlInicio,
    lunaAltitudInicioGrados: luna.altitudInicioGrados,
    iluminacionLunarPorc: Math.round(iluminacion.fraction * 100),
  };
}

module.exports = { brilloArtificialABortle, estimarBortlePorTipoDeLugar, solYLuna };
