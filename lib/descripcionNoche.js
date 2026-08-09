// Genera una descripción profesional de la noche para operadores de astroturismo.
// Analiza clima hora por hora + posición/fase de la luna, y da UNA recomendación
// principal (no todas juntas) según qué condición sea más determinante, con
// variedad en las actividades alternativas sugeridas.

function formatHoraSimple(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function detectarTramosNublados(bloques) {
  const tramos = [];
  let inicio = null;

  bloques.forEach((b, i) => {
    const nublado = b.nubosidad > 70;
    if (nublado && inicio === null) inicio = b.hora;
    if (!nublado && inicio !== null) {
      tramos.push({ desde: inicio, hasta: b.hora });
      inicio = null;
    }
    if (nublado && i === bloques.length - 1) {
      tramos.push({ desde: inicio, hasta: b.hora });
    }
  });

  return tramos;
}

const ACTIVIDADES_ALTERNATIVAS = [
  "una proyección de videos o documentales sobre el universo",
  "juegos interactivos de orientación estelar para todas las edades",
  "una experiencia de realidad aumentada que recree el cielo despejado",
  "una experiencia de realidad virtual inmersiva por el sistema solar",
  "una cata de vinos o productos regionales, con una charla sobre su relación histórica con los ciclos celestes",
];

function elegirActividadAlternativa() {
  return ACTIVIDADES_ALTERNATIVAS[Math.floor(Math.random() * ACTIVIDADES_ALTERNATIVAS.length)];
}

export function generarDescripcionNoche(bloques, datosSolLuna, bortleInfo, inicioVentana) {
  if (!bloques || bloques.length === 0) return null;

  const parrafos = [];

  // --- Panorama general de nubosidad ---
  const nubosidadPromedio = bloques.reduce((a, b) => a + b.nubosidad, 0) / bloques.length;
  const tramosNublados = detectarTramosNublados(bloques);

  if (nubosidadPromedio < 20) {
    parrafos.push(
      "El cielo se presenta prácticamente despejado durante toda la franja horaria seleccionada: condiciones ideales para observación telescópica y astrofotografía de larga exposición."
    );
  } else if (tramosNublados.length > 0) {
    const detalle = tramosNublados
      .map((t) => `entre las ${formatHoraSimple(t.desde)} y las ${formatHoraSimple(t.hasta)} hs`)
      .join(", y ");
    parrafos.push(`Se prevé nubosidad significativa ${detalle}.`);
  } else {
    parrafos.push("La nubosidad se mantiene moderada durante toda la franja horaria, sin tramos críticos identificados.");
  }

  // --- Datos derivados ---
  const vientoPromedio = bloques.reduce((a, b) => a + b.viento, 0) / bloques.length;
  const humedadPromedio = bloques.reduce((a, b) => a + b.humedad, 0) / bloques.length;
  const hayTormenta = bloques.some((b) => b.condicion === "Thunderstorm");

  const lunaArriba = datosSolLuna?.lunaArribaAlInicio;
  const horasHastaPuestaLuna =
    datosSolLuna?.puestaLuna && inicioVentana ? (new Date(datosSolLuna.puestaLuna) - inicioVentana) / 3600000 : null;
  const lunaLlenaOGibosa = (datosSolLuna?.iluminacionLunarPorc ?? 0) >= 70;
  const lunaCercaCenit = (datosSolLuna?.lunaAltitudInicioGrados ?? -90) >= 50;

  // --- Se elige UNA recomendación principal, en orden de prioridad ---

  if (vientoPromedio > 10 || hayTormenta) {
    // 1. Viento fuerte / tormenta
    parrafos.push(
      `Con ${hayTormenta ? "riesgo de tormenta" : `viento fuerte (promedio ${vientoPromedio.toFixed(1)} m/s)`}, hay riesgo estructural ` +
        "para los equipos, vibración en telescopios, baja sensación térmica y polvo en suspensión. Conviene trasladar la experiencia a un " +
        "espacio cerrado (cúpula geodésica, salón o centro de interpretación) y centrar la actividad en mitología y cosmovisiones del cielo " +
        "nocturno, con un taller de orientación con planisferios celestes físicos y digitales. " +
        `También podés sumar ${elegirActividadAlternativa()}.`
    );
  } else if (humedadPromedio > 80) {
    // 2. Humedad alta
    parrafos.push(
      `Con humedad relativa alta (${humedadPromedio.toFixed(0)}%), hay riesgo de condensación y daño en lentes, espejos y circuitos ` +
        "electrónicos: conviene suspender el uso de telescopios y binoculares al aire libre para evitar hongos en los tratamientos " +
        "antirreflejo, y reorientar la actividad hacia relatos de mitología y cosmovisiones, charlas teóricas dinámicas, proyección de " +
        `imágenes o software de planetario en pantalla. También podés sumar ${elegirActividadAlternativa()}.`
    );
  } else if (lunaArriba && horasHastaPuestaLuna !== null && horasHastaPuestaLuna >= 0 && horasHastaPuestaLuna <= 2) {
    // 3. Luna arriba pero por ocultarse pronto: empezar por la luna
    parrafos.push(
      `La Luna está sobre el horizonte pero se oculta pronto (en aproximadamente ${horasHastaPuestaLuna.toFixed(1)} hs), así que conviene ` +
        "estructurar la experiencia en dos tiempos: empezar con observación detallada del relieve lunar (cráteres, mares, cordilleras) y su " +
        "mitología asociada, y luego, tras la puesta de la Luna, pasar a observación a simple vista y con binoculares de la Vía Láctea, " +
        "cúmulos abiertos brillantes y constelaciones, con relatos culturales de cada una."
    );
  } else if (lunaArriba && lunaLlenaOGibosa && lunaCercaCenit) {
    // 4. Luna llena/gibosa cerca del cenit
    parrafos.push(
      `Con la Luna muy iluminada (${datosSolLuna.iluminacionLunarPorc}%) y alta en el cielo, su brillo va a opacar los objetos más tenues. ` +
        "Conviene reorientar el objetivo principal hacia la topografía lunar (cráteres, mares, cordilleras) con binoculares, destacar el " +
        "folclore y las leyendas lunares de distintas culturas, y aprovechar para fotografía lunar con el celular acoplado al ocular."
    );
  } else if (nubosidadPromedio >= 30 && nubosidadPromedio <= 60) {
    // 5. Nubosidad parcial
    parrafos.push(
      "Con nubosidad parcial, la visibilidad va a ser intermitente. Conviene armar una estrategia de \"ventanas de oportunidad\": estar " +
        "atentos en tiempo real a los claros entre nubes para mostrar cúmulos brillantes y constelaciones a simple vista, y mientras tanto " +
        "sostener la experiencia con relatos de mitología y cosmovisiones del cielo nocturno."
    );
  } else if (bortleInfo?.bortle && bortleInfo.bortle >= 6) {
    // 6. Contaminación lumínica alta
    parrafos.push(
      "La contaminación lumínica del lugar es considerable, por lo que conviene orientar la actividad hacia la Luna, planetas y " +
        "constelaciones brillantes (poco afectados por el resplandor del cielo), en vez de objetos más tenues que requieren cielos más " +
        "oscuros, y reforzar la experiencia con mitología y relatos culturales de lo que sí se puede ver bien."
    );
  } else {
    // 7. Buenas condiciones
    parrafos.push(
      "Las condiciones son propicias para un buen programa de astroturismo: observación a simple vista y con binoculares de la Vía " +
        "Láctea, cúmulos abiertos y globulares brillantes, y galaxias brillantes si son visibles desde el lugar, combinada con una charla " +
        "guiada de mitología y cosmovisiones sobre las constelaciones visibles en la franja horaria elegida."
    );
  }

  return parrafos;
}
