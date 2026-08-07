import { useMapEvents } from "react-leaflet";

// Este componente vive en su propio archivo para poder importarlo con
// dynamic(..., { ssr: false }) desde pages/index.js. react-leaflet/leaflet
// tocan `window` apenas se cargan, así que no pueden importarse de forma
// estática en un archivo que Next.js intenta pre-renderizar en el servidor.
export default function LocationMarker({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
}
