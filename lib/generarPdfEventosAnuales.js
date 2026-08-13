const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const ICONO_POR_TIPO = { lluvia: "Lluvia de meteoros", eclipse: "Eclipse", conjuncion: "Conjunción" };

export async function generarPdfEventosAnuales({ eventos, lugarNombre, lat, lon }) {
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NARANJA);
  doc.text("Astroturismo Inteligente", margenIzq, y);
  linea(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS);
  doc.text("Calendario de eventos celestes", margenIzq, y);
  linea(8);
  doc.setFontSize(10);
  doc.setTextColor(...NEGRO);
  doc.text(`Lugar: ${lugarNombre || `${lat}, ${lon}`}`, margenIzq, y);
  linea(6);
  doc.text(`Coordenadas: ${lat}, ${lon}`, margenIzq, y);
  linea(6);
  doc.text(`Generado el: ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`, margenIzq, y);
  linea(10);

  const grupos = {};
  for (const e of eventos) {
    const fecha = new Date(e.fecha);
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}`;
    if (!grupos[clave]) grupos[clave] = { anio: fecha.getFullYear(), mes: fecha.getMonth(), eventos: [] };
    grupos[clave].eventos.push(e);
  }
  const listaGrupos = Object.values(grupos).sort((a, b) => a.anio - b.anio || a.mes - b.mes);

  if (listaGrupos.length === 0) {
    doc.setFontSize(11);
    doc.text("No se detectaron eventos celestes relevantes en este rango.", margenIzq, y);
  }

  for (const g of listaGrupos) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NARANJA);
    doc.text(`${NOMBRES_MES[g.mes]} ${g.anio}`, margenIzq, y);
    linea(7);

    for (const e of g.eventos) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NEGRO);
      const fechaTexto = new Date(e.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
      doc.text(`${fechaTexto} — ${e.nombre}`, margenIzq + 4, y);
      linea(5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      let detalle = e.detalle || "";
      if (e.tipo === "lluvia") detalle = `Visibilidad: ${e.calidadVisibilidad} (hasta ${e.alturaMaximaGrados}°). ${detalle}`;
      const lineasDetalle = doc.splitTextToSize(detalle, 175);
      doc.text(lineasDetalle, margenIzq + 4, y);
      linea(lineasDetalle.length * 4.5 + 3);
    }
    linea(3);
  }

  doc.save(`calendario-eventos-celestes.pdf`);
}
