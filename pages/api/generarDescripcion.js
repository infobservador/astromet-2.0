// Genera la "Descripción de la noche" con Claude (Anthropic), a partir de los datos
// YA CALCULADOS por la app (clima, sol/luna, Bortle) — el modelo redacta el texto,
// pero no inventa ningún dato: se le da todo lo necesario y se le prohíbe explícitamente
// agregar información astronómica que no esté en los datos provistos.
//
// Si no hay ANTHROPIC_API_KEY configurada, o la llamada falla por cualquier motivo,
// se cae automáticamente en el generador local por reglas (lib/descripcionNoche.js),
// para que la app nunca se rompa por esto.

import { generarDescripcionNoche } from "../../lib/descripcionNoche";
import { evaluarBanderaRoja } from "../../lib/seguridad";
import { obtenerOperador, descontarCredito, permitidoPorTopeDiarioPromo } from "../../lib/creditos";
import { estaEnPeriodoDePrueba } from "../../lib/promocion";

function armarPrompt({ lugarNombre, fecha, desdeHora, hastaHora, bloques, solLuna, bortleInfo }) {
  const resumenBloques = bloques
    .map((b) => {
      const hora = new Date(b.hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      return `${hora}: ${b.nubosidad}% nubosidad, ${b.temperatura.toFixed(1)}°C, viento ${b.viento.toFixed(1)} m/s, humedad ${b.humedad}%${b.condicion ? `, condición: ${b.condicion}` : ""}`;
    })
    .join("\n");

  return `Sos un asesor experto en astroturismo, redactando para operadores turísticos profesionales que le van a mostrar este texto directamente a sus clientes o usarlo para planificar la actividad. El texto tiene que ser tan útil y específico que justifique pagar por esta herramienta.

DATOS DE LA NOCHE (no inventes nada que no esté acá):
- Lugar: ${lugarNombre || "sin nombre disponible"}
- Fecha: ${fecha}
- Franja horaria elegida: ${desdeHora}:00 a ${hastaHora}:00 hs

Clima por bloque horario:
${resumenBloques}

Sol y luna:
- Sale el sol: ${solLuna?.salidaSol ? new Date(solLuna.salidaSol).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "sin dato"}
- Se pone el sol: ${solLuna?.puestaSol ? new Date(solLuna.puestaSol).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "sin dato"}
- Comienza la noche astronómica (cielo totalmente oscuro): ${solLuna?.inicioNocheAstronomica ? new Date(solLuna.inicioNocheAstronomica).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "sin dato"}
- Termina la noche astronómica: ${solLuna?.finNocheAstronomica ? new Date(solLuna.finNocheAstronomica).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "sin dato"}
- Luna arriba del horizonte al inicio de la franja: ${solLuna?.lunaArribaAlInicio ? "sí" : "no"}
- Altitud de la luna al inicio (grados): ${solLuna?.lunaAltitudInicioGrados ?? "sin dato"}
- Sale la luna: ${solLuna?.salidaLuna ? new Date(solLuna.salidaLuna).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "no aplica/sin dato"}
- Se pone la luna: ${solLuna?.puestaLuna ? new Date(solLuna.puestaLuna).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "no aplica/sin dato"}
- Iluminación lunar: ${solLuna?.iluminacionLunarPorc ?? "sin dato"}%

Contaminación lumínica:
- Escala de Bortle: ${bortleInfo?.bortle ?? "sin dato"} (fuente: ${bortleInfo?.fuente === "satelital" ? "datos satelitales reales" : "estimación por tipo de lugar"})

CONTEXTO IMPORTANTE — Astroturismo, no astronomía de investigación:
El público es turístico general, no astrónomos con equipo avanzado. Esto significa:
- NUNCA recomiendes objetos débiles que solo se ven con telescopios grandes y larga exposición (nebulosas tenues, galaxias débiles, cúmulos poco brillantes). Un turista no las va a poder ver a simple vista ni con binoculares/telescopios de aficionado chicos.
- Enfocate en objetos BRILLANTES y accesibles: cúmulos abiertos brillantes (ej. Las Pléyades), cúmulos globulares brillantes, galaxias brillantes visibles a simple vista o con binoculares (ej. la Vía Láctea como banda, o galaxias satélite si son visibles desde el hemisferio correspondiente), planetas (si sabés cuáles están arriba por los datos, si no, no los nombres), la Luna, y constelaciones reconocibles.
- El componente de MITOLOGÍA Y CULTURA (historias, cosmovisiones, leyendas asociadas al cielo nocturno) tiene que estar SIEMPRE presente en el texto, en mayor o menor medida — es parte central de la experiencia de astroturismo, no un relleno. Cuando el cielo está feo/nublado, este componente pasa a ser el protagonista de la actividad (ya que no se puede observar bien), no solo una mención de pasada.

Escribí una descripción profesional de la noche en 2 a 3 párrafos cortos, en español rioplatense, que:
1. Resuma el panorama general de la noche, mencionando horas exactas si hay tramos problemáticos (mucha nubosidad, viento, humedad).
2. Dé UNA recomendación operativa concreta y accionable, adaptada específicamente a estos datos: qué observar (siempre objetos brillantes/accesibles, nunca objetos débiles), cómo estructurar la actividad, y el componente de mitología/cultura correspondiente. Si el cielo no acompaña, sumá una actividad alternativa (realidad aumentada/virtual, cata de productos regionales, fotografía) — pero la mitología no se reemplaza, se refuerza. Elegí lo que mejor encaje esta noche en particular, no listes todas las opciones juntas.

Restricciones importantes:
- NO inventes objetos celestes específicos (planetas visibles, lluvias de meteoros, cometas, eclipses) que no estén en los datos de arriba.
- NO recomiendes objetos de cielo profundo débiles (nebulosas tenues, galaxias débiles) — esto es astroturismo, no observación de investigación.
- No repitas siempre la misma estructura de frases entre distintas consultas; sonar natural y variado.
- Tono profesional pero cálido, como un especialista hablándole a un colega del rubro.
- Empezá directo con el primer párrafo. NO agregues título, encabezado, ni ningún formato Markdown (nada de "#", "**", listas con guiones o viñetas). Solo prosa en párrafos separados por un salto de línea.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { lugarNombre, fecha, desdeHora, hastaHora, bloques, solLuna, bortleInfo, codigoOperador } = req.body || {};

  if (!Array.isArray(bloques) || bloques.length === 0) {
    return res.status(400).json({ error: "Faltan datos de clima para generar la descripción." });
  }

  // La seguridad va primero y es determinística: si hay condiciones de riesgo real,
  // ni siquiera se llama a la IA — se devuelve directamente un mensaje fijo, para no
  // depender de que un modelo de lenguaje redacte bien algo tan sensible cada vez.
  const { banderaRoja, motivos } = evaluarBanderaRoja(bloques);
  if (banderaRoja) {
    return res.status(200).json({
      parrafos: [
        `Se recomienda REPROGRAMAR la excursión para otro día. Se detectaron condiciones de riesgo real para la seguridad de los turistas: ${motivos.join(", ")}. La prioridad es la seguridad del grupo, por encima de cualquier actividad alternativa.`,
      ],
      fuente: "seguridad",
      banderaRoja: true,
      motivosBanderaRoja: motivos,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Sistema de créditos: si se manda un código de operador, el uso de IA requiere
  // saldo disponible y se descuenta 1 crédito SOLO si la generación fue exitosa.
  //
  // Si NO se manda código: solo se permite durante el período de lanzamiento gratis
  // (ver lib/promocion.js), y con un tope diario de seguridad para evitar un costo
  // inesperado por uso masivo/scraping. Pasada la fecha de la promo, usar la IA sin
  // código deja de estar permitido — hace falta un código con crédito.
  let operadorInfo = null;
  let puedeUsarIA = false;

  if (apiKey && codigoOperador) {
    operadorInfo = await obtenerOperador(codigoOperador);
    puedeUsarIA = !!operadorInfo && operadorInfo.creditos > 0;
  } else if (apiKey && !codigoOperador && estaEnPeriodoDePrueba()) {
    puedeUsarIA = await permitidoPorTopeDiarioPromo();
  }

  if (puedeUsarIA) {
    try {
      const prompt = armarPrompt({ lugarNombre, fecha, desdeHora, hastaHora, bloques, solLuna, bortleInfo });

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 900,
          temperature: 0.9,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!r.ok) throw new Error(`Anthropic API respondió ${r.status}`);
      const data = await r.json();
      const texto = data.content?.[0]?.text;
      if (!texto) throw new Error("Respuesta vacía de la IA");

      const parrafos = texto
        .split("\n")
        .map((p) => p.trim())
        // Por las dudas, limpia restos de formato Markdown (títulos "#", negrita "**")
        // aunque el prompt ya le pide a la IA que no los use.
        .map((p) => p.replace(/^#+\s*/, "").replace(/\*\*/g, ""))
        .filter((p) => p.length > 0);

      // Recién acá, con la generación ya lista, se descuenta el crédito.
      let creditosRestantes = operadorInfo ? operadorInfo.creditos : null;
      if (codigoOperador && operadorInfo) {
        const actualizado = await descontarCredito(codigoOperador);
        creditosRestantes = actualizado ? actualizado.creditos : creditosRestantes;
      }

      return res.status(200).json({
        parrafos,
        fuente: "ia",
        banderaRoja: false,
        creditosRestantes,
        enPromo: !codigoOperador,
      });
    } catch (err) {
      console.error("Error generando descripción con IA, se usa el generador por reglas:", err.message);
      // No se descontó crédito (la generación falló). Sigue de largo al respaldo por reglas.
    }
  }

  // Respaldo: generador local por reglas (sin costo, sin IA).
  const desdeH = parseInt(desdeHora, 10);
  const inicioVentana =
    fecha && !isNaN(desdeH) ? new Date(`${fecha}T${String(desdeH).padStart(2, "0")}:00:00`) : new Date();
  const parrafos = generarDescripcionNoche(bloques, solLuna, bortleInfo, inicioVentana);
  res.status(200).json({
    parrafos,
    fuente: "reglas",
    banderaRoja: false,
    creditosRestantes: operadorInfo ? operadorInfo.creditos : null,
  });
}
