// Panel de administración de operadores y créditos. Uso interno, solo para vos:
// protegido con una clave simple (ADMIN_SECRET), no es un sistema de login sofisticado
// a propósito. No está enlazado desde ningún botón de la app — se accede escribiendo
// la dirección /admin directamente.
import { useState, useEffect } from "react";

export default function Admin() {
  const [clave, setClave] = useState("");
  const [claveGuardada, setClaveGuardada] = useState("");
  const [operadores, setOperadores] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [creditos, setCreditos] = useState("10");

  useEffect(() => {
    const guardada = window.sessionStorage.getItem("astroturismo_admin_clave");
    if (guardada) {
      setClave(guardada);
      // Antes solo se guardaba la clave, sin volver a pedir la lista de operadores —
      // por eso, al refrescar la página, el panel se veía "vacío" aunque los datos
      // seguían en la base. Ahora sí vuelve a cargarlos.
      cargarOperadores(guardada);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarOperadores(claveAUsar) {
    setError("");
    setCargando(true);
    try {
      const res = await fetch("/api/admin/operadores", {
        headers: { "x-admin-secret": claveAUsar },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setOperadores(json);
      setClaveGuardada(claveAUsar);
      window.sessionStorage.setItem("astroturismo_admin_clave", claveAUsar);
    } catch (err) {
      setError(err.message);
      setOperadores(null);
    } finally {
      setCargando(false);
    }
  }

  async function guardarOperador(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin/operadores", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": claveGuardada },
        body: JSON.stringify({ codigo, nombre, creditos: parseInt(creditos, 10) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setCodigo("");
      setNombre("");
      setCreditos("10");
      cargarOperadores(claveGuardada);
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(codigoAEliminar) {
    if (!confirm(`¿Eliminar el operador "${codigoAEliminar}"?`)) return;
    try {
      const res = await fetch("/api/admin/operadores", {
        method: "DELETE",
        headers: { "content-type": "application/json", "x-admin-secret": claveGuardada },
        body: JSON.stringify({ codigo: codigoAEliminar }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      cargarOperadores(claveGuardada);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!claveGuardada) {
    return (
      <div style={{ maxWidth: 400, margin: "60px auto", padding: 20, fontFamily: "sans-serif" }}>
        <h2>Panel de administración</h2>
        <p>Ingresá la clave de administrador (ADMIN_SECRET).</p>
        <input
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <button onClick={() => cargarOperadores(clave)} disabled={cargando} style={{ padding: "8px 16px" }}>
          {cargando ? "Verificando..." : "Entrar"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Operadores y créditos</h2>
        <button onClick={() => cargarOperadores(claveGuardada)} disabled={cargando} style={{ padding: "6px 14px" }}>
          {cargando ? "Actualizando..." : "🔄 Actualizar"}
        </button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={guardarOperador} style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <input placeholder="Código (ej: JUAN01)" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ padding: 8 }} />
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ padding: 8 }} />
        <input
          type="number"
          placeholder="Créditos"
          value={creditos}
          onChange={(e) => setCreditos(e.target.value)}
          style={{ padding: 8, width: 100 }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>
          Crear / Actualizar
        </button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th style={{ padding: 8 }}>Código</th>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Créditos</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {(operadores || []).map((op) => (
            <tr key={op.codigo} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{op.codigo}</td>
              <td style={{ padding: 8 }}>{op.nombre}</td>
              <td style={{ padding: 8 }}>{op.creditos}</td>
              <td style={{ padding: 8 }}>
                <button onClick={() => eliminar(op.codigo)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!operadores || operadores.length === 0) && <p>Todavía no hay operadores creados.</p>}

      <VerificacionPronostico claveAdmin={claveGuardada} />
    </div>
  );
}

function VerificacionPronostico({ claveAdmin }) {
  const [lat, setLat] = useState("-34.6037");
  const [lon, setLon] = useState("-58.3816");
  const [dias, setDias] = useState("10");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function verificar() {
    setCargando(true);
    setError("");
    setResultado(null);
    try {
      const res = await fetch(`/api/admin/verificarPronostico?lat=${lat}&lon=${lon}&dias=${dias}`, {
        headers: { "x-admin-secret": claveAdmin },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setResultado(json.resultado);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ marginTop: 50, borderTop: "2px solid #ccc", paddingTop: 30 }}>
      <h2>Verificación de pronóstico (datos reales)</h2>
      <p style={{ color: "#555", fontSize: 14, maxWidth: 600 }}>
        Compara lo que Open-Meteo predecía 1, 2, 3 y 5 días antes contra lo que realmente pasó, usando datos
        históricos reales (sin inventar nada). Solo verifica Open-Meteo: OpenWeather no tiene un archivo público
        gratuito de pronósticos pasados para poder auditarlo de la misma forma.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} style={{ padding: 8, width: 130 }} />
        <input placeholder="Longitud" value={lon} onChange={(e) => setLon(e.target.value)} style={{ padding: 8, width: 130 }} />
        <input
          type="number"
          placeholder="Días hacia atrás"
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          style={{ padding: 8, width: 130 }}
        />
        <button onClick={verificar} disabled={cargando} style={{ padding: "8px 16px" }}>
          {cargando ? "Verificando..." : "Verificar"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {resultado && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th style={{ padding: 8 }}>Variable</th>
              <th style={{ padding: 8 }}>1 día antes</th>
              <th style={{ padding: 8 }}>2 días antes</th>
              <th style={{ padding: 8 }}>3 días antes</th>
              <th style={{ padding: 8 }}>5 días antes</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((fila) => (
              <tr key={fila.variable} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8, fontWeight: "bold" }}>{fila.etiqueta}</td>
                {[1, 2, 3, 5].map((d) => (
                  <td key={d} style={{ padding: 8 }}>
                    {fila.porDia[d] ? (
                      <>
                        error medio: {fila.porDia[d].errorAbsolutoPromedio}
                        <br />
                        <span style={{ fontSize: 12, color: "#777" }}>
                          sesgo: {fila.porDia[d].sesgo > 0 ? "+" : ""}
                          {fila.porDia[d].sesgo} · n={fila.porDia[d].muestras}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado && (
        <p style={{ color: "#555", fontSize: 13, marginTop: 12, maxWidth: 600 }}>
          "Error medio" = en promedio, cuánto se equivocó el pronóstico (siempre positivo, no importa la
          dirección). "Sesgo" = si el pronóstico tiende a sobreestimar (+) o subestimar (-) sistemáticamente. Un
          sesgo grande y consistente es lo que indicaría que conviene aplicar una corrección.
        </p>
      )}
    </div>
  );
}
