# Qué se corrigió

1. **Seguridad**: se quitó `.env.local` del proyecto (nunca debe subirse a GitHub) y se
   agregó `.gitignore` para que no vuelva a pasar. Vos tenés que:
   - Regenerar tu API key de OpenWeather (la vieja quedó expuesta públicamente).
   - Regenerar tu token de NASA Earthdata.
   - Crear tu propio `.env.local` localmente (no lo subas) usando `.env.local.example`
     como guía, con las claves nuevas.
   - En Vercel: **Project Settings → Environment Variables** → agregar `OPENWEATHER_KEY`
     con tu clave nueva (sin el prefijo `NEXT_PUBLIC_`, porque ahora se usa solo en el servidor).

2. **Bug principal por el que no andaba el clima**: en tu `.env.local` original había un
   doble `=` (`NEXT_PUBLIC_OPENWEATHER_KEY==...`) que rompía la clave. Además, el frontend
   y el backend usaban nombres de variable distintos (`NEXT_PUBLIC_OPENWEATHER_KEY` vs
   `OPENWEATHER_KEY`). Ahora todo usa **una sola variable**: `OPENWEATHER_KEY`, solo en el
   servidor, y el frontend llama a `/api/weather` en vez de golpear OpenWeather directo
   desde el navegador (más seguro, y más fácil de mantener).

3. Se borró `pages/api/astro.js`, que era un duplicado de `lib/astro.js` sin el
   `export default function handler`, lo cual rompe cualquier ruta de Next.js si se llega
   a invocar directamente.

4. `lib/astro.js` (función del Bortle / contaminación lumínica): el endpoint de la NASA
   que tenía Copilot (`https://nasa-api-endpoint/...`) es un placeholder inventado, no
   existe. Ahora esa función falla de forma controlada (devuelve `bortle: null`) en vez de
   tirar error 500. **Para tener el dato real de contaminación lumínica vas a necesitar
   integrar un servicio real** (por ejemplo la API de lightpollutionmap.info, o procesar
   vos mismo datos VIIRS de NASA, que es más laborioso). Si querés, te ayudo a integrar eso
   en otro paso.

5. `pages/api/weather.js` ahora valida que existan `lat`/`lon` y la API key, y maneja
   errores de la API externa en vez de romper con un 500 genérico.

# Cómo aplicar esto

1. Reemplazá los archivos de tu repo por estos (o copiá y pegá el contenido de cada uno).
2. Borrá tu `.env.local` viejo (con las claves filtradas) si todavía lo tenés localmente,
   y creá uno nuevo con las claves regeneradas.
3. `git add .` → `git commit -m "fix: seguridad y bug de API key"` → `git push`
4. En Vercel, agregá la variable de entorno `OPENWEATHER_KEY` (Settings → Environment
   Variables) y volvé a desplegar (Redeploy).

# Segunda pasada: la app ahora hace todo lo que describiste

- Al hacer clic en el mapa, se piden en paralelo: clima (`/api/weather`), horarios de
  sol/luna (`/api/solyluna`) y contaminación lumínica (`/api/bortle`). Con eso se arma
  **un solo consejo combinado** (Excelente / Buena / Regular) que tiene en cuenta
  nubosidad, viento, escala de Bortle y qué tan iluminada está la luna.

- **Bug de datos de luna**: `solYLuna` le pedía `moonrise`/`moonset` a la API de
  sunrise-sunset.org, pero esa API **no tiene datos de luna**, solo de sol — ese campo
  siempre daba `undefined`. Ahora se calcula todo (sol, luna, % de iluminación lunar,
  inicio/fin de la "noche astronómica" cuando el cielo está totalmente oscuro) con
  `SunCalc`, en el propio servidor, sin depender de una API externa que no tenía el dato.

- **Bug de build que probablemente te rompía el deploy en Vercel**: `useMapEvents` se
  importaba directo de `react-leaflet` al principio de `pages/index.js`. Esa librería
  toca `window` apenas se carga, y `window` no existe en el servidor — Next.js intenta
  pre-renderizar esa página en el servidor durante `next build`, así que el build fallaba
  con `ReferenceError: window is not defined`. Lo separé en `components/LocationMarker.js`
  y lo cargo con `dynamic(..., { ssr: false })`, igual que el mapa. **Verifiqué que
  `next build` ahora termina bien.**

- `components/Map.js` (el placeholder gris que decía "aquí luego integrás Leaflet") se
  borró porque no se usaba — el mapa real ya está armado en `index.js`.

- `components/Results.js` ahora sí se usa, y muestra clima, sol/luna y Bortle ordenados.

- `pages/api/clima.js` y `pages/api/comentario.js` siguen sin conectarse al frontend
  (usan clima de un solo punto en vez del pronóstico); no hacían falta para lo que
  pediste, pero quedan disponibles si más adelante querés usarlos.

# Tercera pasada: diseño e identidad de marca

- Paleta azul (cielo nocturno) + botones naranja, definida en `styles/globals.css`
  usando variables CSS (`--azul-noche`, `--naranja`, etc.) para que sea fácil de
  ajustar más adelante si querés retocar algún tono.
- Logo del Instituto Latinoamericano de Astroturismo agregado en `public/logo.png`.
- Email de contacto actualizado a `info@astroturismo.com.ar`.

# Cuarta pasada: buscador, marcador, fecha/hora, y Bortle estimado

- **Marcador en el mapa**: al hacer clic (o buscar) ahora se ve un pin en el punto
  elegido (`components/LocationMarker.js`), con ícono cargado desde CDN para evitar
  el bug clásico de Next.js con los íconos de Leaflet.
- **Nombre del lugar**: nueva ruta `pages/api/lugar.js`, usa geocodificación inversa
  de OpenStreetMap/Nominatim (gratis, sin API key). Se muestra junto a las coordenadas.
- **Buscador por texto**: nueva ruta `pages/api/buscar.js` (geocodificación directa).
  Escribís un nombre de lugar, elegís de la lista de resultados, y el mapa se centra ahí.
- **Fecha + rango horario**: podés elegir una fecha y un rango tipo "19hs a 3hs del otro
  día" (si "hasta" es menor que "desde", se asume que cruza la medianoche). El pronóstico
  del clima ahora promedia los bloques de OpenWeather dentro de ese rango exacto, en vez
  de usar siempre "ahora + 6 horas". Sol/luna también se recalculan para la fecha elegida.
- **Validación de fecha/hora** (`construirRangoFechaHora` en `pages/index.js`): rechaza
  fechas con formato inválido, horas fuera de 0-23, fechas ya pasadas, y fechas a más de
  5 días (límite del pronóstico gratuito de OpenWeather), mostrando un mensaje claro en
  vez de romper la página.
- **Bortle con comentario**: como no hay datos satelitales reales conectados, ahora se
  estima el valor de Bortle según el tipo de lugar (ciudad/pueblo/zona rural/área
  protegida) usando la clasificación que ya devuelve OpenStreetMap, y siempre se muestra
  un comentario explicando que es una aproximación. `pages/api/clima.js` y
  `pages/api/comentario.js` se borraron porque dependían de funciones que ya no existen
  en `lib/astro.js` y nunca estuvieron conectadas al frontend.
- Botones de arriba ahora despliegan un panel con información real (fuentes de datos y
  qué tan precisos son), en vez de un `alert()` genérico.

# Quinta pasada: Bortle con datos satelitales reales (opcional)

- Encontré un servicio real y gratuito (`lightpollutionmap.info`) que usa el **World
  Atlas 2015** (Falchi et al.), basado en datos satelitales NASA/NOAA VIIRS reales, para
  consultar el brillo artificial del cielo por coordenadas.
- `pages/api/bortle.js` ahora intenta ese servicio PRIMERO (si configurás
  `LIGHTPOLLUTION_KEY` en tus variables de entorno). Si no está configurada, o el
  servicio falla por cualquier motivo, cae automáticamente en la estimación por tipo de
  lugar (ciudad/pueblo/zona rural/área protegida) como respaldo, sin romper la app.
- La respuesta siempre indica de qué fuente salió el dato ("Estimado con datos
  satelitales reales..." vs "...estimado por tipo de lugar, sin datos satelitales").
- **Cómo conseguir la clave** (gratis, no es inmediato): hay que escribirle por mail a
  Jurij Stare (el mantenedor del sitio) a starej@t-2.net, pidiendo acceso al endpoint
  `QueryRaster` (capa `wa_2015`) para tu app. Te suele dar 500 consultas gratis por día.
  No hace falta que hagas esto ahora — la app funciona igual sin la clave, solo que con
  la estimación aproximada en vez del dato satelital.
- La conversión de brillo artificial a Bortle usa la fórmula publicada por el propio
  sitio (brillo → SQM → Bortle), implementada en `lib/astro.js`
  (`brilloArtificialABortle`).

# Sexta pasada: tarjetas visuales + descripción profesional para astroturismo

- **Resultados de sol/luna y clima ahora se muestran como tarjetas** con íconos SVG
  propios (sol/luna con flecha arriba o abajo según sale o se pone, luna con fase
  parcialmente rellena según % de iluminación, termómetro, nube, gota, viento, ojo para
  Bortle). Todo dibujado en `components/Results.js`, sin librerías externas de íconos.
- **Nueva "Descripción de la noche"** (`lib/descripcionNoche.js`): en vez de un consejo
  genérico, ahora analiza los bloques de pronóstico HORA POR HORA (no solo el promedio)
  para detectar tramos con mucha nubosidad y decirlo explícitamente (ej. "nubosidad
  significativa entre las 21:00 y las 00:00 hs"). Después da una recomendación de
  actividad según el panorama:
  - Muy nublado → sugiere reforzar con realidad aumentada, charlas de mitología/
    cosmovisiones ancestrales, u observación solar/planetaria en otro horario.
  - Bortle alto (mucha contaminación lumínica) → sugiere enfocarse en Luna, planetas y
    estrellas dobles en vez de cielo profundo.
  - Luna muy iluminada → sugiere observación lunar/planetaria de detalle.
  - Buenas condiciones → sugiere programa completo de cielo profundo + astrofotografía.
  El "Excelente/Buena/Regular" de antes se mantiene como resumen rápido arriba de todo.

# Séptima pasada: botones reorganizados, layout de tarjetas, y motor de recomendaciones completo

- **Botones**: "Descripción" queda arriba (con texto mucho más extenso). "Quiénes somos"
  y "Fuentes y precisión técnica" se movieron al pie de página, también con texto más
  extenso. Cualquier clic fuera de un panel abierto (o fuera del botón que lo abrió) lo
  cierra automáticamente.
- **Tarjetas de Sol y Luna en 3 columnas**: izquierda = salida/puesta de sol; centro =
  comienzo/fin de la noche astronómica; derecha = salida/puesta de la luna, cada columna
  apilada verticalmente. El ícono de "noche" ahora es solo estrellas (sin luna).
- **Motor de recomendaciones completo** (`lib/descripcionNoche.js`), con prioridad entre
  escenarios (se muestra UNO principal, no todos apilados):
  1. Viento fuerte (>10 m/s) o tormenta → espacio cerrado, astronomía inmersiva, taller de
     orientación con planisferios + una actividad alternativa variable (video, juegos, RA,
     RV, o cata de productos regionales — rota entre esas opciones).
  2. Humedad alta (>80%) → proteger óptica, charlas teóricas, software de planetario +
     actividad alternativa variable.
  3. Luna arriba y a menos de 2 hs de ocultarse → estructura en dos tiempos: primero Luna
     y mitología, después cielo profundo tras la puesta.
  4. Luna llena/gibosa (iluminación ≥70%) y alta en el cielo (altitud ≥50°) → enfoque
     lunar/planetario con filtros, folclore lunar, fotografía con celular.
  5. Nubosidad parcial (30-60%) → estrategia de "ventanas de oportunidad".
  6. Bortle alto (≥6) → enfoque en Luna/planetas/dobles en vez de cielo profundo.
  7. Buenas condiciones → programa completo de cielo profundo + astrofotografía.
- Para el punto 3, ahora se calcula la altitud real de la luna al inicio de la franja
  horaria elegida, y se busca correctamente el PRÓXIMO evento de salida/puesta de luna
  revisando también el día siguiente del calendario (esto corrige un caso real donde,
  si la puesta de luna caía después de medianoche, el cálculo anterior podía no
  detectarla).
- `pages/api/weather.js` ahora también informa la condición climática de cada bloque
  (ej. "Thunderstorm"), usada para detectar riesgo de tormenta.

# Octava pasada: clave real de lightpollutionmap.info

- Confirmada la documentación real del servicio (coincide con la implementación previa):
  endpoint `https://www.lightpollutionmap.info/QueryRaster/`, parámetros `ql` (capa,
  usamos `wa_2015`), `qt=point`, `qd` en formato `longitud,latitud`, y `key`.
- `pages/api/bortle.js` ahora interpreta la respuesta de forma más tolerante (prueba
  JSON primero, si no interpreta como texto/CSV), ya que la documentación no fija un
  único formato estricto para consultas de tipo "point".
- Para activarlo: agregar `LIGHTPOLLUTION_KEY` en Vercel (Settings → Environment
  Variables) con la clave que te dieron, y hacer Redeploy. No hace falta cambiar nada
  más: el resto del código ya está preparado para usarla automáticamente.

# Novena pasada: confirmado funcionando + limpieza

- La causa del problema anterior era simplemente que `LIGHTPOLLUTION_KEY` nunca se había
  guardado en Vercel (solo estaba `OPENWEATHER_KEY`). Una vez agregada, el dato satelital
  real empezó a funcionar (probado: Bortle 1, SQM 21.86 mag/arcsec² en un punto de
  prueba).
- Se sacó el mensaje de diagnóstico temporal de `pages/api/bortle.js` (ya cumplió su
  función).

# Décima pasada: pronóstico combinado (OpenWeather + Open-Meteo)

- `pages/api/weather.js` ahora consulta DOS fuentes de clima en paralelo:
  - **OpenWeather** (como antes, bloques de 3 horas, hasta 5 días, necesita clave).
  - **Open-Meteo** (nueva, datos por hora, hasta 16 días, **sin necesidad de clave ni
    registro** — no hay que pedirle nada a nadie).
- Cuando ambas responden para la fecha/hora elegida, se promedian entre sí (temperatura,
  nubosidad, humedad, viento) para un resultado más robusto que depender de una sola
  fuente.
- Si solo una tiene datos para esa fecha (por ejemplo, una fecha a más de 5 días, donde
  OpenWeather ya no llega pero Open-Meteo sí), se usa esa sola, sin romper la app.
- La app ahora muestra qué fuente(s) se usaron en cada consulta (debajo de "Clima").
- Como consecuencia, el límite de fecha seleccionable en el formulario subió de 5 a 15
  días hacia adelante.
- El promedio ya no se calcula en el navegador (`pages/index.js`); lo devuelve directo
  la API, ya combinado.

# Undécima pasada: validación "a prueba de tontos"

- **Fecha y hora** (`construirRangoFechaHora` en `pages/index.js`):
  - Las horas "Desde"/"Hasta" ahora se validan con una expresión regular que exige un
    entero exacto: rechaza decimales ("3.5"), texto ("abc"), notación científica ("5e3")
    y vacíos, además de seguir rechazando números fuera de 0-23 (incluidos negativos).
  - La fecha rechaza años absurdos (antes de 2020 o después de 2100) aunque el formato
    sea válido.
  - Se separó el chequeo de "ya pasó" (con margen de 3 hs) del de "demasiado en el
    pasado" (más de 1 día atrás, por si se tipea una fecha vieja a mano).
  - El selector de fecha del formulario ahora tiene tope máximo de 15 días (antes solo
    tenía mínimo "hoy"), acorde al horizonte real de pronóstico disponible.
  - Los campos de hora ahora tienen `step="1"` e `inputMode="numeric"` para desalentar
    decimales desde el teclado, además de la validación real del lado del código.
- **Coordenadas** (nuevo `lib/validacion.js`, usado en `weather.js`, `solyluna.js`,
  `bortle.js` y `lugar.js`): valida que lat/lon sean números (no texto), estén presentes,
  y dentro de rango real (-90 a 90 / -180 a 180). Esto protege la API por si alguien arma
  la URL a mano, aunque desde la interfaz normal las coordenadas siempre vienen del mapa
  o del buscador.
- **Rango de fecha/hora en `pages/api/weather.js`**: además de la validación del
  formulario, la API ahora rechaza directamente fechas fuera de un rango razonable
  (más de 2 días atrás o más de 20 días adelante), como defensa adicional si se llama
  a la API directamente sin pasar por el formulario.
- **Búsqueda por texto** (`pages/api/buscar.js`): además del mínimo de 2 caracteres, ahora
  también rechaza textos de más de 200 caracteres.

# Duodécima pasada: comparador de noches, PDF, favoritos, y modo offline básico

De las 5 mejoras sugeridas, se implementaron 4 completas. La quinta (alertas
automáticas por mail) necesita que te registres en un servicio de envío de emails
(similar a lo que hicimos con OpenWeather o lightpollutionmap.info) antes de poder
conectarla — no la armé a medias para no dejar algo que parezca funcionar sin funcionar
de verdad. Cuando quieras armarla, avisame y vemos qué servicio conviene (Resend es
buena opción, con alta gratuita instantánea, sin trámite de aprobación manual).

## 1. Comparador de varias noches
- Nueva sección al final de la página: elegís cuántas noches comparar (1 a 15) y usa el
  mismo horario (Desde/Hasta) ya configurado arriba, para el lugar seleccionado.
- Consulta clima + sol/luna de cada noche (reutilizando el mismo Bortle, ya que no
  cambia noche a noche) y las ordena de mejor a peor según el mismo puntaje que ya usa
  `generarConsejo` (ahora expone ese puntaje numérico, antes solo devolvía el texto).
- Cada fila tiene un botón "Ver detalle" que carga el resultado completo de esa noche
  puntual (clima, sol/luna, descripción profesional, etc.).
- Se corrigió un bug propio durante el desarrollo: al hacer clic en "Ver detalle",
  `calcularParaUbicacion` usaba la fecha vieja por un problema de actualización
  asincrónica de estado en React. Ahora acepta la fecha como parámetro explícito en
  vez de depender del estado.

## 2. Reporte en PDF
- Botón "Descargar reporte en PDF" arriba de los resultados.
- Usa la librería `jspdf` (nueva dependencia), cargada de forma dinámica solo del lado
  del cliente (mismo motivo que con Leaflet: evitar problemas de renderizado en el
  servidor).
- El PDF incluye: lugar, fecha/horario, evaluación general, descripción de la noche
  completa, clima, sol/luna, y contaminación lumínica — todo lo que se ve en pantalla,
  en un documento prolijo para mandarle a un cliente antes de la salida.

## 3. Favoritos
- Botón "☆ Guardar" junto a la ubicación seleccionada.
- Se guardan en el propio navegador (localStorage) — no hay cuenta de usuario ni base
  de datos del lado del servidor, así que los favoritos son por dispositivo/navegador,
  no se sincronizan entre celular y computadora. Si más adelante querés que sí se
  sincronicen entre dispositivos, hace falta agregar una base de datos real (otro paso
  de infraestructura, avisame si te interesa).
- Aparecen como chips debajo del buscador; un clic carga esa ubicación al instante.

## 4. Modo offline básico (PWA)
- Se agregó `public/manifest.json` y `public/sw.js` (service worker), registrado en
  `pages/_app.js`.
- Cachea el "shell" de la aplicación (HTML, CSS, JS, logo) para que la interfaz cargue
  aunque no haya señal, y se pueda instalar como app en el celular ("Agregar a
  pantalla de inicio").
- IMPORTANTE: esto NO permite calcular clima/sol-luna/Bortle sin conexión — esos datos
  siempre requieren señal, ya que vienen de servicios externos en tiempo real. Lo que
  sí permite es que la app no quede en blanco/rota si se corta la señal en el lugar,
  y que se pueda abrir más rápido en visitas siguientes.

# Decimotercera pasada: descripción de la noche generada con IA (opcional)

- Nueva ruta `pages/api/generarDescripcion.js`: le manda a Claude (Anthropic, modelo
  `claude-haiku-4-5-20251001`, económico) TODOS los datos ya calculados por la app
  (clima hora por hora, sol/luna, Bortle) y le pide que redacte la descripción de la
  noche. Se le prohíbe explícitamente inventar datos astronómicos que no estén en la
  información provista (nada de "hay una lluvia de meteoros" si no lo sabemos).
- Es OPCIONAL: si no está configurada la variable `ANTHROPIC_API_KEY`, o la llamada
  falla por cualquier motivo, cae automáticamente en el generador local por reglas de
  siempre (`lib/descripcionNoche.js`) — la app nunca se rompe por esto ni deja de
  mostrar una descripción.
- El resultado ahora indica de dónde salió el texto ("✨ Generado con IA" o "Generado
  por reglas"), igual que ya hacíamos con el clima y el Bortle.
- Para activarlo: conseguir una clave en console.anthropic.com (autoservicio, con
  tarjeta cargada) y agregarla como `ANTHROPIC_API_KEY` en Vercel, igual que las demás
  variables. Costo estimado: centavos de dólar por consulta con el modelo elegido
  (Haiku 4.5).
- El comparador de varias noches sigue usando el puntaje del generador local (rápido y
  sin costo) para ordenar las noches — la descripción completa con IA solo se genera
  para la noche puntual que se esté mirando en detalle, no para las 15 noches del
  comparador (para no generar 15 llamadas a la IA en una sola comparación).

# Decimocuarta pasada: ajuste de enfoque para astroturismo real (no astronomía de investigación)

- El prompt de la IA (`pages/api/generarDescripcion.js`) y el generador local por reglas
  (`lib/descripcionNoche.js`) ahora dejan explícito que el público es turístico general,
  no astrónomos con equipo avanzado:
  - Ya NO se recomiendan objetos débiles (nebulosas tenues, galaxias débiles) que
    requieren telescopios grandes y larga exposición — un turista no los va a poder ver.
  - Se prioriza: cúmulos abiertos y globulares BRILLANTES, galaxias brillantes visibles a
    simple vista o con binoculares, la Vía Láctea, la Luna, planetas (solo si hay datos),
    y constelaciones reconocibles.
  - El componente de MITOLOGÍA Y COSMOVISIONES CULTURALES ahora está presente siempre en
    el texto, no solo como actividad alternativa — y se vuelve el protagonista cuando el
    cielo está nublado/feo, en vez de perderse.
- Se corrigieron dos problemas técnicos encontrados al probar el prompt nuevo contra la
  API real: la IA a veces agregaba un título con formato Markdown (`# ...`) a pesar de
  la instrucción de no hacerlo, y el texto se cortaba a mitad de frase por un límite de
  longitud (`max_tokens`) demasiado corto para este prompt más largo. Se subió el límite
  de 600 a 900 tokens, se reforzó la instrucción contra Markdown, y se agregó una
  limpieza automática del texto (por si el modelo se olvida) que saca cualquier resto de
  "#" o "**" antes de mostrarlo.

# Decimoquinta pasada: bug del service worker (por eso había que forzar refresco)

- **Causa encontrada**: el service worker (`public/sw.js`) usaba estrategia "caché
  primero, red después" — una vez que el navegador guardaba una versión de la app, la
  seguía mostrando siempre, sin importar que se subieran cambios nuevos, hasta forzar un
  refresco manual (Ctrl+Shift+R). En el celular el problema era el mismo, pero ahí es
  más difícil forzar el refresco, por eso quedaba pegado en la versión vieja.
- **Corrección**: ahora es "red primero, caché como respaldo" (network-first). Mientras
  haya señal, siempre pide la versión más nueva al servidor; el caché guardado solo se
  usa si no hay conexión (que es justamente para lo que se agregó el modo offline).
- Se subió la versión del caché (v1 → v2) para que, apenas se detecte el service worker
  nuevo, se borre el caché viejo automáticamente.
- **Una sola vez más** conviene hacer un refresco forzado después de subir este cambio
  puntual (en el celular: borrar datos/caché del sitio desde la configuración del
  navegador, o abrirlo en una pestaña nueva). De ahí en adelante, los próximos cambios
  deberían reflejarse solos, sin necesitar Ctrl+Shift+R cada vez.

# Decimosexta pasada: ícono propio "Astromet" (favicon + PWA)

- Se diseñó un ícono cuadrado nuevo (`public/icon-192.png`, `icon-512.png`,
  `icon-180.png`, `favicon-32.png`), un planeta naranja con anillo celeste, retomando
  el mismo motivo visual de tu logo del Instituto, pero en formato cuadrado — el logo
  horizontal completo no se leía bien achicado a un ícono de pestaña o de celular.
- `public/manifest.json` actualizado con los tamaños correctos de ícono (antes tenía
  mal declarado el tamaño del logo horizontal, 1343x341, que no es válido para un ícono
  de app instalable).
- `pages/_app.js`: la pestaña del navegador y el ícono al instalar la app en el celular
  ahora usan este ícono nuevo en vez del logo horizontal.
- El logo horizontal (`public/logo.png`) sigue igual en el encabezado de la página, no
  se tocó nada ahí.

# Decimoséptima pasada: bandera roja de seguridad + logo Astromet 2.0

## Bandera roja de seguridad (prioridad absoluta sobre cualquier otra recomendación)
- Nuevo `lib/seguridad.js`: evalúa condiciones de riesgo real para los turistas —
  80% o más de probabilidad de lluvia/nieve, riesgo de tormenta eléctrica, nevada
  significativa, viento peligroso (>15 m/s), o frío extremo combinado con viento
  (riesgo de hipotermia). Es más conservador a propósito: mejor una alerta de más
  que un accidente.
- Se agregó el dato de "probabilidad de precipitación" (que antes no se pedía) a
  ambas fuentes de clima (OpenWeather ya lo tenía disponible con el campo `pop`;
  Open-Meteo se pidió explícitamente con `precipitation_probability`). También se
  tradujeron los "weather codes" de Open-Meteo a las mismas categorías que usa
  OpenWeather (Thunderstorm, Snow, etc.) para que la detección de tormenta/nevada
  funcione igual sin importar qué fuente haya respondido.
- **Cuando hay bandera roja, la IA NI SIQUIERA SE LLAMA**: se devuelve directamente
  un mensaje fijo y predecible recomendando reprogramar, con los motivos exactos.
  Para algo tan sensible como la seguridad, no quise depender de que un modelo de
  lenguaje lo redacte bien cada vez.
- Aparece un banner rojo bien visible arriba de los resultados cuando corresponde.
- En el comparador de varias noches, las noches peligrosas se marcan con 🚩, muestran
  el motivo en vez de las métricas normales, y quedan siempre al final del ranking.
- En el PDF descargable, si hay bandera roja aparece un recuadro rojo arriba de todo
  con el motivo, antes que cualquier otro dato.
- Nueva tarjeta "Prob. de lluvia/nieve" en la sección de clima de los resultados.

## Logo "Astromet 2.0"
- Se agregó tu logo nuevo (`public/logo-astromet.png`) en el encabezado, debajo del
  logo del Instituto y arriba del título, en la misma posición y proporción que
  mostraste en la captura.

# Decimoctava pasada: logo Astromet sin "2.0"

- Se sacó el "2.0" del logo visible (`public/logo-astromet.png`), ya que para uso
  comercial de cara al cliente el "2.0" podía leerse como "todavía en desarrollo".
  El nombre interno del proyecto/repo sigue siendo "astromet-2.0", solo cambió la
  marca visible en la app.
- Se editó el archivo de imagen directamente (no se volvió a generar desde cero):
  el "2.0" estaba separado del trazo del swoosh naranja sin tocarlo, así que se pudo
  borrar limpio sin dejar cortes ni artefactos en el resto del diseño.
