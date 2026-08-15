import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ICONO_POR_TIPO = { lluvia: "🌠", eclipse: "🌘", conjuncion: "🪐" };

function agruparPorMes(eventos) {
  const grupos = {};
  for (const e of eventos) {
    const fecha = new Date(e.fecha);
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}`;
    if (!grupos[clave]) {
      grupos[clave] = { anio: fecha.getFullYear(), mes: fecha.getMonth(), eventos: [] };
    }
    grupos[clave].eventos.push(e);
  }
  return Object.values(grupos).sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}

export default function EventosAnuales() {
  const router = useRouter();
  const { lat, lon, nombre } = router.query;

  const [eventos, setEventos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [anios, setAnios] = useState(1);

  useEffect(() => {
    if (!lat || !lon) return;
    setCargando(true);
    setError("");
    fetch(`/api/eventosAnuales?lat=${lat}&lon=${lon}&anios=${anios}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setEventos(json.eventos);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [lat, lon, anios]);

  async function descargarPdf() {
    const { generarPdfEventosAnuales } = await import("../lib/generarPdfEventosAnuales");
    await generarPdfEventosAnuales({ eventos, lugarNombre: nombre, lat, lon });
  }

  if (!lat || !lon) {
    return (
      <div className="pagina-eventos-anuales">
        <Head>
          <title>Eventos del año — Astroturismo Inteligente</title>
        </Head>
        <p>
          Para ver el calendario de eventos, volvé a la app principal, elegí un lugar en el mapa, y desde ahí hacé
          clic en "📅 Ver eventos del año".
        </p>
        <a href="/">← Volver a la app</a>
      </div>
    );
  }

  const grupos = eventos ? agruparPorMes(eventos) : [];

  return (
    <div className="pagina-eventos-anuales">
      <Head>
        <title>Eventos del año — Astroturismo Inteligente</title>
      </Head>
      <a href="/" className="volver-app">
        ← Volver a la app
      </a>
      <h1>Calendario de eventos celestes</h1>
      <p className="subtitulo-eventos">
        {nombre ? <strong>{nombre}</strong> : `${lat}, ${lon}`} — {anios === 1 ? "próximo año" : "próximos 2 años"}, solo
        eventos visibles desde este lugar
      </p>

      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <button className="boton-naranja" onClick={() => setAnios(1)} disabled={anios === 1}>
          1 año
        </button>
        <button className="boton-naranja" onClick={() => setAnios(2)} disabled={anios === 2}>
          2 años
        </button>
      </div>

      {cargando && <p>Calculando eventos (puede tardar unos segundos)...</p>}
      {error && <p className="error-clima">{error}</p>}

      {eventos && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button className="boton-naranja" onClick={descargarPdf}>
              Descargar en PDF
            </button>
            <button className="boton-naranja" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
          </div>

          {grupos.length === 0 && <p>No se detectaron eventos celestes relevantes en este rango.</p>}

          {grupos.map((g) => (
            <div key={`${g.anio}-${g.mes}`} className="mes-eventos">
              <h2>
                {NOMBRES_MES[g.mes]} {g.anio}
              </h2>
              <ul>
                {g.eventos.map((e, i) => (
                  <li key={i}>
                    {e.tipo === "eclipse" ? (e.subtipo === "solar" ? "☀️" : "🌘") : ICONO_POR_TIPO[e.tipo]} <strong>{e.nombre}</strong> —{" "}
                    {new Date(e.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                    {e.tipo === "lluvia" && <> · visibilidad: {e.calidadVisibilidad} (hasta {e.alturaMaximaGrados}°)</>}
                    <div className="mes-eventos-detalle">{e.detalle}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
