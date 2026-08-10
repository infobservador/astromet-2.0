// Compara lo que el pronóstico de Open-Meteo decía X días antes contra lo que
// realmente pasó, usando datos reales (Previous Runs API de Open-Meteo, sin clave).
//
// _previous_dayN = valor que el modelo predijo N días antes de esa hora.
// El valor "sin sufijo" (day0) es la corrida más reciente para esa hora, ya
// inicializada con observaciones reales (asimilación de datos) — se usa como
// referencia de "lo que realmente pasó".
//
// LIMITACIÓN IMPORTANTE: esto verifica Open-Meteo, una de las dos fuentes que
// combina la app. OpenWeather (la otra fuente) no tiene un archivo público
// gratuito de pronósticos pasados, así que no se puede auditar de la misma forma.

const DIAS_A_VERIFICAR = [1, 2, 3, 5];
const VARIABLES = ["temperature_2m", "cloud_cover", "wind_speed_10m", "precipitation"];

const ETIQUETAS_VARIABLE = {
  temperature_2m: "Temperatura (°C)",
  cloud_cover: "Nubosidad (%)",
  wind_speed_10m: "Viento (m/s)",
  precipitation: "Precipitación (mm)",
};

export async function verificarPronostico(lat, lon, diasHaciaAtras = 10) {
  const varsConLead = VARIABLES.flatMap((v) => [v, ...DIAS_A_VERIFICAR.map((d) => `${v}_previous_day${d}`)]);

  const url =
    `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${varsConLead.join(",")}&past_days=${diasHaciaAtras}&forecast_days=1&wind_speed_unit=ms`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Previous Runs API respondió ${r.status}`);
  const data = await r.json();

  if (!data.hourly || !Array.isArray(data.hourly.time)) {
    throw new Error("Respuesta inesperada de la API de verificación.");
  }

  const horas = data.hourly.time;
  const resultado = [];

  for (const variable of VARIABLES) {
    const real = data.hourly[variable];
    const filaVariable = { variable, etiqueta: ETIQUETAS_VARIABLE[variable], porDia: {} };

    for (const dia of DIAS_A_VERIFICAR) {
      const previsto = data.hourly[`${variable}_previous_day${dia}`];
      if (!previsto) continue;

      let sumaError = 0;
      let sumaAbsoluta = 0;
      let n = 0;
      for (let i = 0; i < horas.length; i++) {
        const r1 = real?.[i];
        const p1 = previsto?.[i];
        if (r1 === null || r1 === undefined || p1 === null || p1 === undefined) continue;
        sumaError += p1 - r1;
        sumaAbsoluta += Math.abs(p1 - r1);
        n++;
      }

      if (n > 0) {
        filaVariable.porDia[dia] = {
          sesgo: Math.round((sumaError / n) * 100) / 100, // + = el pronóstico sobreestima; - = subestima
          errorAbsolutoPromedio: Math.round((sumaAbsoluta / n) * 100) / 100,
          muestras: n,
        };
      }
    }

    resultado.push(filaVariable);
  }

  return resultado;
}
