// Eventos celestes reales: lluvias de meteoros, conjunciones planetarias y eclipses.
// Las conjunciones y eclipses se calculan con astronomy-engine (librería astronómica
// de código abierto, validada contra datos de la NASA/JPL) — no son estimaciones.
// Las lluvias de meteoros usan una tabla fija con las fechas típicas anuales (pueden
// variar un día o dos según el año; para el pico exacto conviene confirmar con una
// fuente oficial más cerca de la fecha).

const Astronomy = require("astronomy-engine");

// --- Lluvias de meteoros ---
// visibilidadSur: qué tan bien se observa esta lluvia desde Sudamérica (radiante
// alto o bajo en el cielo austral). "alta" = muy recomendable, "baja" = apenas
// visible o no visible desde estas latitudes.
const LLUVIAS_METEOROS = [
  { nombre: "Cuadrántidas", inicioMD: "12-28", picoMD: "01-04", finMD: "01-12", zhr: 120, visibilidadSur: "baja" },
  { nombre: "Líridas", inicioMD: "04-16", picoMD: "04-22", finMD: "04-25", zhr: 18, visibilidadSur: "media" },
  { nombre: "Eta Acuáridas", inicioMD: "04-19", picoMD: "05-05", finMD: "05-28", zhr: 50, visibilidadSur: "alta" },
  { nombre: "Delta Acuáridas del Sur", inicioMD: "07-12", picoMD: "07-30", finMD: "08-23", zhr: 25, visibilidadSur: "alta" },
  { nombre: "Perseidas", inicioMD: "07-17", picoMD: "08-12", finMD: "08-24", zhr: 100, visibilidadSur: "baja" },
  { nombre: "Oriónidas", inicioMD: "10-02", picoMD: "10-21", finMD: "11-07", zhr: 20, visibilidadSur: "media" },
  { nombre: "Leónidas", inicioMD: "11-06", picoMD: "11-17", finMD: "11-30", zhr: 15, visibilidadSur: "media" },
  { nombre: "Gemínidas", inicioMD: "12-04", picoMD: "12-14", finMD: "12-17", zhr: 150, visibilidadSur: "media" },
];

function formatoMD(fecha) {
  return `${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function fechaEnRangoMD(md, inicioMD, finMD) {
  // Maneja rangos que cruzan fin de año (ej: Cuadrántidas, dic → ene).
  if (inicioMD <= finMD) return md >= inicioMD && md <= finMD;
  return md >= inicioMD || md <= finMD;
}

function detectarLluviasMeteoros(fecha) {
  const md = formatoMD(fecha);
  return LLUVIAS_METEOROS.filter((l) => fechaEnRangoMD(md, l.inicioMD, l.finMD)).map((l) => ({
    ...l,
    esPico: md === l.picoMD,
  }));
}

// --- Conjunciones planetarias ---
// Separación angular real entre planetas visibles sobre el horizonte. Se considera
// "conjunción" cuando dos planetas están a 5° o menos entre sí, ambos razonablemente
// altos sobre el horizonte (>5°) como para ser observables.
const CUERPOS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const UMBRAL_CONJUNCION_GRADOS = 5;
const ALTITUD_MINIMA_GRADOS = 5;

function detectarConjunciones(fecha, lat, lon) {
  try {
    const observer = new Astronomy.Observer(lat, lon, 0);
    const tiempo = Astronomy.MakeTime(fecha);

    const posiciones = {};
    for (const cuerpo of CUERPOS) {
      const eq = Astronomy.Equator(cuerpo, tiempo, observer, true, true);
      const hor = Astronomy.Horizon(tiempo, observer, eq.ra, eq.dec, "normal");
      posiciones[cuerpo] = { vec: eq.vec, altitud: hor.altitude };
    }

    const conjunciones = [];
    for (let i = 0; i < CUERPOS.length; i++) {
      for (let j = i + 1; j < CUERPOS.length; j++) {
        const a = CUERPOS[i];
        const b = CUERPOS[j];
        if (posiciones[a].altitud < ALTITUD_MINIMA_GRADOS || posiciones[b].altitud < ALTITUD_MINIMA_GRADOS) continue;
        const separacion = Astronomy.AngleBetween(posiciones[a].vec, posiciones[b].vec);
        if (separacion <= UMBRAL_CONJUNCION_GRADOS) {
          conjunciones.push({ cuerpos: [a, b], separacionGrados: Math.round(separacion * 10) / 10 });
        }
      }
    }
    return conjunciones;
  } catch (err) {
    console.error("Error calculando conjunciones:", err.message);
    return [];
  }
}

// --- Eclipses ---
// Solo se informa si el próximo eclipse (solar visible desde el lugar consultado, o
// lunar) cae dentro de los próximos 30 días desde la fecha de la consulta.
const DIAS_AVISO_ECLIPSE = 30;

function detectarEclipses(fecha, lat, lon) {
  const resultado = [];
  const tiempo = Astronomy.MakeTime(fecha);

  try {
    const observer = new Astronomy.Observer(lat, lon, 0);
    const eclipseSolar = Astronomy.SearchLocalSolarEclipse(tiempo, observer);
    const diasHasta = (eclipseSolar.peak.time.date.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24);
    if (diasHasta >= 0 && diasHasta <= DIAS_AVISO_ECLIPSE) {
      resultado.push({
        tipo: "solar",
        clase: eclipseSolar.kind,
        fecha: eclipseSolar.peak.time.date,
        obscuracion: Math.round(eclipseSolar.obscuration * 1000) / 10, // %
      });
    }
  } catch (err) {
    // Puede no encontrar un eclipse solar local cercano; no es un error real.
  }

  try {
    const eclipseLunar = Astronomy.SearchLunarEclipse(tiempo);
    const diasHasta = (eclipseLunar.peak.date.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24);
    if (diasHasta >= 0 && diasHasta <= DIAS_AVISO_ECLIPSE) {
      resultado.push({
        tipo: "lunar",
        clase: eclipseLunar.kind,
        fecha: eclipseLunar.peak.date,
      });
    }
  } catch (err) {
    // Idem.
  }

  return resultado;
}

function eventosCelestesDelDia(fecha, lat, lon) {
  return {
    lluviasMeteoros: detectarLluviasMeteoros(fecha),
    conjunciones: detectarConjunciones(fecha, lat, lon),
    eclipses: detectarEclipses(fecha, lat, lon),
  };
}

module.exports = { eventosCelestesDelDia };
