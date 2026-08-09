function formatHora(iso) {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const colorPorNivel = {
  Excelente: "#8ee6a0",
  Buena: "#ffd27a",
  Regular: "#ffb4a2",
};

// --- Iconos (SVG en línea, sin dependencias externas) ---
function IconoBase({ children }) {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconoSol({ flecha }) {
  return (
    <IconoBase>
      <circle cx="16" cy="20" r="7" />
      <line x1="16" y1="4" x2="16" y2="7" />
      <line x1="16" y1="33" x2="16" y2="36" />
      <line x1="4" y1="20" x2="7" y2="20" />
      <line x1="3.5" y1="9" x2="6" y2="11.5" />
      <line x1="3.5" y1="31" x2="6" y2="28.5" />
      {flecha === "arriba" && <polyline points="30,30 30,14 25,19 30,14 35,19" />}
      {flecha === "abajo" && <polyline points="30,10 30,26 25,21 30,26 35,21" />}
    </IconoBase>
  );
}

function IconoLuna({ flecha }) {
  return (
    <IconoBase>
      <path d="M20 8a13 13 0 1 0 12 18A10 10 0 0 1 20 8Z" />
      {flecha === "arriba" && <polyline points="32,32 32,16 27,21 32,16 37,21" />}
      {flecha === "abajo" && <polyline points="32,10 32,26 27,21 32,26 37,21" />}
    </IconoBase>
  );
}

function IconoNoche() {
  return (
    <IconoBase>
      <path d="M10 12 L11.5 16 L15.5 17.5 L11.5 19 L10 23 L8.5 19 L4.5 17.5 L8.5 16 Z" fill="currentColor" stroke="none" />
      <path d="M27 6 L28 9 L31 10 L28 11 L27 14 L26 11 L23 10 L26 9 Z" fill="currentColor" stroke="none" />
      <path d="M31 20 L31.7 22 L33.5 22.7 L31.7 23.5 L31 25.5 L30.3 23.5 L28.5 22.7 L30.3 22 Z" fill="currentColor" stroke="none" />
    </IconoBase>
  );
}

function IconoFaseLunar({ porcentaje }) {
  const id = `clip-${porcentaje}`;
  const alturaVisible = 32 * (porcentaje / 100);
  return (
    <svg viewBox="0 0 40 40" width="30" height="30">
      <defs>
        <clipPath id={id}>
          <rect x="4" y={36 - alturaVisible} width="32" height={alturaVisible} />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="20" r="15" fill="currentColor" clipPath={`url(#${id})`} />
    </svg>
  );
}

function IconoTermometro() {
  return (
    <IconoBase>
      <rect x="17" y="6" width="6" height="20" rx="3" />
      <circle cx="20" cy="30" r="6" />
      <line x1="20" y1="12" x2="20" y2="24" />
    </IconoBase>
  );
}

function IconoNube() {
  return (
    <IconoBase>
      <path d="M11 27a7 7 0 0 1 1-14 9 9 0 0 1 17 3 6 6 0 0 1-1 11H11Z" />
    </IconoBase>
  );
}

function IconoGota() {
  return (
    <IconoBase>
      <path d="M20 6c6 8 10 13 10 18a10 10 0 0 1-20 0c0-5 4-10 10-18Z" />
    </IconoBase>
  );
}

function IconoViento() {
  return (
    <IconoBase>
      <path d="M4 14h20a4 4 0 1 0-4-4" />
      <path d="M4 22h26a4 4 0 1 1-4 4" />
      <path d="M4 30h16a3 3 0 1 0-3-3" />
    </IconoBase>
  );
}

function IconoOjo() {
  return (
    <IconoBase>
      <path d="M4 20s6-11 16-11 16 11 16 11-6 11-16 11S4 20 4 20Z" />
      <circle cx="20" cy="20" r="4" />
    </IconoBase>
  );
}

function Tarjeta({ icono, etiqueta, valor }) {
  return (
    <div className="tarjeta">
      <div className="tarjeta-icono">{icono}</div>
      <div className="tarjeta-texto">
        <div className="tarjeta-valor">{valor}</div>
        <div className="tarjeta-etiqueta">{etiqueta}</div>
      </div>
    </div>
  );
}

export default function Results({ data, advice, descripcionNoche, descripcionFuente }) {
  const { weather, solLuna, bortle } = data;

  return (
    <div className="panel-resultados">
      {advice && (
        <p className="consejo" style={{ color: colorPorNivel[advice.nivel] || "inherit" }}>
          {advice.nivel}: {advice.texto}
        </p>
      )}

      {descripcionNoche && descripcionNoche.length > 0 && (
        <div className="descripcion-noche">
          <div className="descripcion-noche-header">
            <h3>Descripción de la noche</h3>
            {descripcionFuente && (
              <span className="descripcion-fuente">{descripcionFuente === "ia" ? "✨ Generado con IA" : "Generado por reglas"}</span>
            )}
          </div>
          {descripcionNoche.map((parrafo, i) => (
            <p key={i}>{parrafo}</p>
          ))}
        </div>
      )}

      <h3>Sol y Luna</h3>
      {solLuna ? (
        <>
          <div className="columnas-sol-luna">
            <div className="columna">
              <Tarjeta icono={<IconoSol flecha="arriba" />} etiqueta="Salida del sol" valor={formatHora(solLuna.salidaSol)} />
              <Tarjeta icono={<IconoSol flecha="abajo" />} etiqueta="Puesta de sol" valor={formatHora(solLuna.puestaSol)} />
            </div>
            <div className="columna">
              <Tarjeta icono={<IconoNoche />} etiqueta="Comienza noche astronómica" valor={formatHora(solLuna.inicioNocheAstronomica)} />
              <Tarjeta icono={<IconoNoche />} etiqueta="Termina noche astronómica" valor={formatHora(solLuna.finNocheAstronomica)} />
            </div>
            <div className="columna">
              <Tarjeta
                icono={<IconoLuna flecha="arriba" />}
                etiqueta="Salida de la luna"
                valor={solLuna.lunaSiempreArriba ? "No se pone hoy" : formatHora(solLuna.salidaLuna)}
              />
              <Tarjeta
                icono={<IconoLuna flecha="abajo" />}
                etiqueta="Puesta de la luna"
                valor={solLuna.lunaSiempreAbajo ? "No sale hoy" : formatHora(solLuna.puestaLuna)}
              />
            </div>
          </div>
          <div className="tarjetas-grid tarjeta-iluminacion">
            <Tarjeta
              icono={<IconoFaseLunar porcentaje={solLuna.iluminacionLunarPorc} />}
              etiqueta="Iluminación lunar"
              valor={`${solLuna.iluminacionLunarPorc}%`}
            />
          </div>
        </>
      ) : (
        <p>No se pudieron calcular los horarios de sol y luna.</p>
      )}

      <h3>Clima</h3>
      {data.weatherFuentes && data.weatherFuentes.length > 0 && (
        <p className="fuentes-clima">Fuentes: {data.weatherFuentes.join(" + ")}</p>
      )}
      <div className="tarjetas-grid">
        <Tarjeta icono={<IconoTermometro />} etiqueta="Temperatura" valor={`${weather.temp.toFixed(1)} °C`} />
        <Tarjeta icono={<IconoNube />} etiqueta="Nubosidad" valor={`${weather.clouds.toFixed(0)}%`} />
        <Tarjeta icono={<IconoGota />} etiqueta="Humedad" valor={`${weather.humidity.toFixed(0)}%`} />
        <Tarjeta icono={<IconoViento />} etiqueta="Viento" valor={`${weather.wind.toFixed(1)} m/s`} />
      </div>

      <h3>Contaminación lumínica</h3>
      <div className="tarjetas-grid">
        <Tarjeta icono={<IconoOjo />} etiqueta="Escala de Bortle" valor={bortle !== null && bortle !== undefined ? bortle : "No disponible"} />
      </div>
      {data.bortleComentario && <p className="bortle-comentario">{data.bortleComentario}</p>}
    </div>
  );
}
