// Genera una descripción profesional de la noche para operadores de astroturismo:
// no solo dice "buena/regular", sino que identifica tramos horarios problemáticos
// y sugiere cómo adaptar la actividad (observación profunda, lunar/planetaria,
// o programación alternativa si el cielo no acompaña).

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

export function generarDescripcionNoche(bloques, solLuna, bortleInfo) {
  if (!bloques || bloques.length === 0) return null;

  const nubosidadPromedio = bloques.reduce((acc, b) => acc + b.nubosidad, 0) / bloques.length;
  const tramosNublados = detectarTramosNublados(bloques);
  const parrafos = [];

  // Panorama de nubosidad
  if (nubosidadPromedio < 20) {
    parrafos.push(
      "El cielo se presenta prácticamente despejado durante toda la franja horaria seleccionada: condiciones ideales para observación telescópica y astrofotografía de larga exposición."
    );
  } else if (tramosNublados.length > 0) {
    const detalle = tramosNublados
      .map((t) => `entre las ${formatHoraSimple(t.desde)} y las ${formatHoraSimple(t.hasta)} hs`)
      .join(", y ");
    parrafos.push(
      `Se prevé nubosidad significativa ${detalle}, lo que puede dificultar la observación en ese tramo. Conviene concentrar la actividad principal fuera de esos horarios.`
    );
  } else {
    parrafos.push("La nubosidad se mantiene moderada durante toda la franja horaria, sin tramos críticos identificados.");
  }

  // Recomendación de actividad según el panorama
  if (nubosidadPromedio > 60) {
    parrafos.push(
      "Con este panorama, conviene reforzar la propuesta con actividades que no dependan de un cielo despejado: una experiencia de realidad aumentada que recree constelaciones y objetos celestes, una charla sobre mitología y cosmovisiones ancestrales del cielo nocturno, o una observación solar/planetaria en un horario alternativo con mejores condiciones."
    );
  } else if (bortleInfo?.bortle && bortleInfo.bortle >= 6) {
    parrafos.push(
      "La contaminación lumínica del lugar es considerable, por lo que conviene orientar la actividad hacia la Luna, planetas y estrellas dobles (poco afectados por el resplandor del cielo), en vez de objetos de cielo profundo como nebulosas o galaxias, que requieren cielos más oscuros."
    );
  } else if (solLuna?.iluminacionLunarPorc > 70) {
    parrafos.push(
      `Con la Luna iluminada en un ${solLuna.iluminacionLunarPorc}%, es un excelente momento para observación lunar y planetaria de alto detalle, aunque los objetos de cielo profundo (nebulosas, cúmulos, galaxias) se verán menos contrastados por el resplandor lunar. Es un buen horario para combinar telescopio con relatos de mitología lunar.`
    );
  } else {
    parrafos.push(
      "Las condiciones son propicias para un programa completo: observación de cielo profundo (nebulosas, cúmulos, galaxias), astrofotografía, y una charla guiada sobre las constelaciones visibles en la franja horaria elegida."
    );
  }

  return parrafos;
}
