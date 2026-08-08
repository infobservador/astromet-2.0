// Validación de coordenadas compartida por las rutas de API. Protege contra
// URLs manipuladas a mano con lat/lon vacíos, con texto, o fuera de rango.
function parsearCoordenadas(latRaw, lonRaw) {
  if (latRaw === undefined || lonRaw === undefined || latRaw === "" || lonRaw === "") {
    return { error: "Faltan parámetros lat y lon" };
  }

  const lat = parseFloat(latRaw);
  const lon = parseFloat(lonRaw);

  if (isNaN(lat) || isNaN(lon)) {
    return { error: "Las coordenadas deben ser números." };
  }
  if (lat < -90 || lat > 90) {
    return { error: "La latitud debe estar entre -90 y 90." };
  }
  if (lon < -180 || lon > 180) {
    return { error: "La longitud debe estar entre -180 y 180." };
  }

  return { lat, lon };
}

module.exports = { parsearCoordenadas };
