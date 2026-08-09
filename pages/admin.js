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
    </div>
  );
}
