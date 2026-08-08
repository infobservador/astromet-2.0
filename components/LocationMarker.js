import { Marker, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

// Ícono del marcador cargado desde un CDN, para evitar problemas conocidos de
// Next.js/Webpack con las imágenes por defecto de Leaflet.
const iconoUbicacion = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// posicion: {lat, lng} del punto seleccionado (se muestra el marcador ahí).
// onSelect: se llama con {lat, lng} cuando el usuario hace clic en el mapa.
// centrarEn: cuando cambia (ej. tras una búsqueda por texto), el mapa se mueve ahí.
export default function LocationMarker({ posicion, onSelect, centrarEn }) {
  const map = useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });

  useEffect(() => {
    if (centrarEn) {
      map.flyTo([centrarEn.lat, centrarEn.lng], 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEn]);

  return posicion ? <Marker position={posicion} icon={iconoUbicacion} /> : null;
}
