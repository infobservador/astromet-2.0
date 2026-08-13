// Calendario de eventos celestes para un lugar específico, a lo largo de varios años
// (por defecto, el año actual y el siguiente). Reutiliza los mismos cálculos reales
// de lib/eventosCelestes.js (astronomy-engine), pero recorre un rango largo de fechas
// en vez de una sola noche.
const Astronomy = require("astronomy-engine");
const { LLUVIAS_METEOROS, calidadVisibilidad, traducirClaseEclipse } = require("./eventosCelestes");

// --- Lluvias de meteoros del calendario: una entrada por año por lluvia, con la
// fecha de pico real de ese año (las fechas de pico varían apenas año a año; acá se
// usa el día de referencia típico, sirve para planificar con antelación).
function lluviasMeteorosDelRango(anioInicio, cantidadAnios, lat) {
  const eventos = [];
  for (let i = 0; i < cantidadAnios; i++) {
    const anio = anioInicio + i;
    for (const l of LLUVIAS_METEOROS) {
      const [mes, dia] = l.picoMD.split("-").map(Number);
      // Las Cuadrántidas tienen pico en enero pero "empiezan" en diciembre del año
      // anterior; para el calendario alcanza con listar el pico de cada año.
      const fechaPico = new Date(anio, mes - 1, dia, 22, 0, 0);
      const visibilidad = calidadVisibilidad(lat, l.declinacionRadiante);
      if (visibilidad.nivel === "no visible") continue;
      eventos.push({
        tipo: "lluvia",
        nombre: l.nombre,
        fecha: fechaPico,
        calidadVisibilidad: visibilidad.nivel,
        alturaMaximaGrados: visibilidad.alturaMaxima,
        detalle: `ZHR máxima teórica: ${l.zhr} meteoros/hora en condiciones ideales (cielo muy oscuro, radiante en el cenit)`,
      });
    }
  }
  return eventos;
}

// --- Eclipses del rango: se busca repetidamente el "próximo eclipse" a partir de
// cada uno encontrado, hasta salir del rango de fechas pedido.
function eclipsesDelRango(fechaInicio, fechaFin, lat, lon) {
  const eventos = [];
  const observer = new Astronomy.Observer(lat, lon, 0);

  let cursorSolar = Astronomy.MakeTime(fechaInicio);
  for (let i = 0; i < 10; i++) {
    let eclipse;
    try {
      eclipse = Astronomy.SearchLocalSolarEclipse(cursorSolar, observer);
    } catch {
      break;
    }
    if (eclipse.peak.time.date > fechaFin) break;
    const obscuracion = Math.round(eclipse.obscuration * 1000) / 10;
    // Un eclipse con obscuración casi nula (rozando el horizonte de visibilidad) no
    // es realmente perceptible ni relevante para planificar una actividad.
    if (obscuracion >= 1) {
      eventos.push({
        tipo: "eclipse",
        subtipo: "solar",
        nombre: `Eclipse solar ${traducirClaseEclipse(eclipse.kind)}`,
        fecha: eclipse.peak.time.date,
        detalle: `Obscuración desde este lugar: ${obscuracion}%`,
      });
    }
    cursorSolar = Astronomy.MakeTime(new Date(eclipse.peak.time.date.getTime() + 24 * 60 * 60 * 1000));
  }

  let cursorLunar = Astronomy.MakeTime(fechaInicio);
  for (let i = 0; i < 10; i++) {
    let eclipse;
    try {
      eclipse = Astronomy.SearchLunarEclipse(cursorLunar);
    } catch {
      break;
    }
    if (eclipse.peak.date > fechaFin) break;
    eventos.push({
      tipo: "eclipse",
      subtipo: "lunar",
      nombre: `Eclipse lunar ${traducirClaseEclipse(eclipse.kind)}`,
      fecha: eclipse.peak.date,
      detalle: "Los eclipses lunares se ven desde todo el lado nocturno de la Tierra (si el cielo está despejado).",
    });
    cursorLunar = Astronomy.MakeTime(new Date(eclipse.peak.date.getTime() + 24 * 60 * 60 * 1000));
  }

  return eventos;
}

// --- Conjunciones del rango: se revisa la separación angular entre planetas una vez
// por día (a una hora aproximada de "noche local", estimada por la longitud), y se
// agrupan los días consecutivos con la misma pareja de planetas en un solo evento.
const CUERPOS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const UMBRAL_CONJUNCION_GRADOS = 5;
const ALTITUD_MINIMA_GRADOS = 5;

function separacionesDelDia(fecha, lat, lon) {
  const observer = new Astronomy.Observer(lat, lon, 0);
  // Hora aproximada de "noche local" según la longitud (estimación simple, no usa
  // huso horario real, alcanza para saber qué día conviene revisar).
  const horaUTCAprox = Math.round(22 - lon / 15 + 24) % 24;
  const tiempo = Astronomy.MakeTime(
    new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), horaUTCAprox))
  );

  const posiciones = {};
  for (const cuerpo of CUERPOS) {
    const eq = Astronomy.Equator(cuerpo, tiempo, observer, true, true);
    const hor = Astronomy.Horizon(tiempo, observer, eq.ra, eq.dec, "normal");
    posiciones[cuerpo] = { vec: eq.vec, altitud: hor.altitude };
  }

  const resultado = [];
  for (let i = 0; i < CUERPOS.length; i++) {
    for (let j = i + 1; j < CUERPOS.length; j++) {
      const a = CUERPOS[i];
      const b = CUERPOS[j];
      if (posiciones[a].altitud < ALTITUD_MINIMA_GRADOS || posiciones[b].altitud < ALTITUD_MINIMA_GRADOS) continue;
      const separacion = Astronomy.AngleBetween(posiciones[a].vec, posiciones[b].vec);
      if (separacion <= UMBRAL_CONJUNCION_GRADOS) {
        resultado.push({ par: `${a}-${b}`, cuerpos: [a, b], separacionGrados: Math.round(separacion * 10) / 10 });
      }
    }
  }
  return resultado;
}

function conjuncionesDelRango(fechaInicio, fechaFin, lat, lon) {
  const eventosPorPar = {}; // par -> {inicio, fin, separacionMin, cuerpos}
  const unDia = 24 * 60 * 60 * 1000;

  for (let t = fechaInicio.getTime(); t <= fechaFin.getTime(); t += unDia) {
    const dia = new Date(t);
    const separaciones = separacionesDelDia(dia, lat, lon);

    for (const s of separaciones) {
      const existente = eventosPorPar[s.par];
      if (existente && dia.getTime() - existente.fin.getTime() <= unDia * 1.5) {
        // Continúa la misma racha de conjunción.
        existente.fin = dia;
        if (s.separacionGrados < existente.separacionMinima) {
          existente.separacionMinima = s.separacionGrados;
          existente.fechaMinima = dia;
        }
      } else {
        eventosPorPar[s.par] = {
          cuerpos: s.cuerpos,
          inicio: dia,
          fin: dia,
          separacionMinima: s.separacionGrados,
          fechaMinima: dia,
        };
      }
    }
  }

  return Object.values(eventosPorPar).map((e) => ({
    tipo: "conjuncion",
    nombre: `Conjunción: ${e.cuerpos.join(" y ")}`,
    fecha: e.fechaMinima,
    detalle: `Separación mínima: ${e.separacionMinima}°`,
  }));
}

function eventosAnualesDelLugar(lat, lon, anioInicio, cantidadAnios = 2) {
  const fechaInicio = new Date(anioInicio, 0, 1);
  const fechaFin = new Date(anioInicio + cantidadAnios, 0, 1);

  const eventos = [
    ...lluviasMeteorosDelRango(anioInicio, cantidadAnios, lat),
    ...eclipsesDelRango(fechaInicio, fechaFin, lat, lon),
    ...conjuncionesDelRango(fechaInicio, fechaFin, lat, lon),
  ];

  eventos.sort((a, b) => a.fecha - b.fecha);
  return eventos;
}

module.exports = { eventosAnualesDelLugar };
