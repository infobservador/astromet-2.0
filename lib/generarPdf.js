// Genera un PDF con el reporte de la noche seleccionada. Se importa jsPDF de forma
// dinámica (no al principio del archivo) porque toca APIs del navegador y no debe
// evaluarse en el servidor durante el renderizado de Next.js.

function formatHora(iso) {
  if (!iso) return "No disponible";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "No disponible";
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export async function generarPdfReporte({ data, advice, descripcionNoche, lugarNombre, coords, fecha, desdeHora, hastaHora, banderaRoja, motivosBanderaRoja }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margenIzq = 15;
  let y = 20;

  const NARANJA = [255, 122, 41];
  const GRIS = [90, 90, 90];
  const NEGRO = [20, 20, 20];

  function linea(alto = 7) {
    y += alto;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  }

  function titulo(texto, tamano = 14) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tamano);
    doc.setTextColor(...NARANJA);
    doc.text(texto, margenIzq, y);
    linea(tamano === 14 ? 9 : 7);
  }

  function parrafo(texto, tamano = 10) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tamano);
    doc.setTextColor(...NEGRO);
    const lineas = doc.splitTextToSize(texto, 180);
    doc.text(lineas, margenIzq, y);
    linea(lineas.length * 5 + 2);
  }

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NARANJA);
  doc.text("Astroturismo Inteligente", margenIzq, y);
  linea(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS);
  doc.text("Reporte de condiciones para observación astronómica", margenIzq, y);
  linea(10);

  // Lugar y fecha bien destacados arriba de todo, en formato legible.
  const fechaLegible = new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NEGRO);
  doc.text(lugarNombre || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`, margenIzq, y);
  linea(7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GRIS);
  doc.text(`${fechaLegible} — de ${desdeHora}:00 a ${hastaHora}:00 hs`, margenIzq, y);
  linea(10);

  // Bandera roja de seguridad (si corresponde, bien destacada)
  if (banderaRoja) {
    const ROJO = [200, 30, 30];
    doc.setFillColor(...ROJO);
    doc.rect(margenIzq - 3, y - 5, 180, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("SE RECOMIENDA REPROGRAMAR LA EXCURSIÓN", margenIzq, y + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const motivosTexto = `Motivos: ${(motivosBanderaRoja || []).join(", ")}`;
    const lineasMotivos = doc.splitTextToSize(motivosTexto, 175);
    doc.text(lineasMotivos, margenIzq, y + 9);
    y += 22;
    doc.setTextColor(...NEGRO);
  }

  // Datos generales
  titulo("Lugar y horario", 12);
  parrafo(`Ubicación: ${lugarNombre || "sin nombre disponible"}`);
  parrafo(`Coordenadas: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
  parrafo(`Fecha: ${fechaLegible}   Horario: ${desdeHora}:00 a ${hastaHora}:00 hs`);
  linea(2);

  // Consejo
  if (advice) {
    titulo("Evaluación general", 12);
    parrafo(`${advice.nivel}: ${advice.texto}`);
    linea(2);
  }

  // Descripción de la noche
  if (descripcionNoche && descripcionNoche.length > 0) {
    titulo("Descripción de la noche", 12);
    descripcionNoche.forEach((p) => parrafo(p));
    linea(2);
  }

  // Clima
  if (data?.weather) {
    titulo("Clima", 12);
    parrafo(
      `Temperatura: ${data.weather.temp.toFixed(1)} °C   Nubosidad: ${data.weather.clouds.toFixed(0)}%   ` +
        `Humedad: ${data.weather.humidity.toFixed(0)}%   Viento: ${data.weather.wind.toFixed(1)} m/s` +
        (data.weather.probPrecipitacion !== null && data.weather.probPrecipitacion !== undefined
          ? `   Prob. de lluvia/nieve: ${data.weather.probPrecipitacion.toFixed(0)}%`
          : "")
    );
    if (data.weatherFuentes) parrafo(`Fuentes: ${data.weatherFuentes.join(" + ")}`, 8);
    linea(2);
  }

  // Sol y luna
  if (data?.solLuna) {
    titulo("Sol y Luna", 12);
    const sl = data.solLuna;
    parrafo(`Salida del sol: ${formatHora(sl.salidaSol)}   Puesta de sol: ${formatHora(sl.puestaSol)}`);
    parrafo(`Comienza noche astronómica: ${formatHora(sl.inicioNocheAstronomica)}   Termina: ${formatHora(sl.finNocheAstronomica)}`);
    parrafo(
      `Luna: ${sl.lunaSiempreArriba ? "no se pone hoy" : sl.lunaSiempreAbajo ? "no sale hoy" : `sale ${formatHora(sl.salidaLuna)}, se pone ${formatHora(sl.puestaLuna)}`}`
    );
    parrafo(`Iluminación lunar: ${sl.iluminacionLunarPorc}%`);
    linea(2);
  }

  // Eventos celestes
  const ec = data?.eventosCelestes;
  const hayEventos = ec && (ec.lluviasMeteoros?.length || ec.conjunciones?.length || ec.eclipses?.length);
  if (hayEventos) {
    titulo("Eventos celestes", 12);
    for (const l of ec.lluviasMeteoros || []) {
      parrafo(`Lluvia de meteoros ${l.nombre}${l.esPico ? " (hoy es el pico)" : " (activa)"} — visibilidad desde esta latitud: ${l.calidadVisibilidad} (hasta ${l.alturaMaximaGrados}° de altura)`);
    }
    for (const c of ec.conjunciones || []) {
      parrafo(`Conjunción real: ${c.cuerpos.join(" y ")}, separados ${c.separacionGrados}° en el cielo`);
    }
    for (const e of ec.eclipses || []) {
      const fechaEclipse = new Date(e.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
      parrafo(`Eclipse ${e.tipo} (${e.clase}) el ${fechaEclipse}`);
    }
    linea(2);
  }

  // Bortle
  if (data) {
    titulo("Contaminación lumínica", 12);
    parrafo(`Escala de Bortle: ${data.bortle !== null && data.bortle !== undefined ? data.bortle : "No disponible"}`);
    if (data.bortleComentario) parrafo(data.bortleComentario, 9);
  }

  // Pie de página
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text("Instituto Latinoamericano de Astroturismo — info@astroturismo.com.ar", margenIzq, 290);

  doc.save(`reporte-astroturismo-${fecha}.pdf`);
}
