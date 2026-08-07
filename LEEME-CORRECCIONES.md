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
