/* ==========================================
   PINES DE ESTACIONAMIENTO - src/map/markers/estacionamientoMarkers.js
   Capa opcional del mapa (checkboxes del panel de capas, ver index.html +
   src/ui/events.js): dónde dejar la moto o el auto cerca del centro.
   Lista precargada a mano (no hay ninguna fuente de datos real de
   estacionamientos todavía) — mismo criterio que LUGARES_PRECARGADOS en
   data/lugaresRepo.js hasta que exista una capa de datos propia.
   ========================================== */
import { state } from '../../core/store.js';
import { crearPopupHTML } from '../popups/popupBuilder.js';

const ESTACIONAMIENTOS_PRECARGADOS = [
    { id: 'moto-1', tipo: 'moto', nombre: 'Estacionamiento de motos - Plaza Cabral', lat: -27.4735, lng: -58.8339 },
    { id: 'moto-2', tipo: 'moto', nombre: 'Estacionamiento de motos - Costanera', lat: -27.4592, lng: -58.8663 },
    { id: 'auto-1', tipo: 'auto', nombre: 'Estacionamiento de autos - Centenario Shopping', lat: -27.4832, lng: -58.8120 },
    { id: 'auto-2', tipo: 'auto', nombre: 'Estacionamiento de autos - Costanera', lat: -27.4600, lng: -58.8670 },
];

let markersPorTipo = { moto: [], auto: [] };

function iconoPara(tipo) {
    const emoji = tipo === 'moto' ? '🛵' : '🅿️';
    return L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background: #1c1c1e; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.3); font-size: 16px; border: 2.5px solid white;">${emoji}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -20],
    });
}

// Pinta (o saca) los pines de un tipo puntual — "moto" o "auto" — sin tocar
// los del otro tipo, para que ambas capas se puedan prender/apagar por su
// cuenta desde el panel de capas.
export function toggleEstacionamientos(tipo, mostrar) {
    const mapa = state.map;
    if (!mapa) return;

    markersPorTipo[tipo].forEach((marker) => mapa.removeLayer(marker));
    markersPorTipo[tipo] = [];

    if (!mostrar) return;

    ESTACIONAMIENTOS_PRECARGADOS
        .filter((e) => e.tipo === tipo)
        .forEach((estacionamiento) => {
            const marker = L.marker([estacionamiento.lat, estacionamiento.lng], { icon: iconoPara(tipo) }).addTo(mapa);
            const popupContent = crearPopupHTML({
                badgeTexto: tipo === 'moto' ? 'Estacionamiento moto' : 'Estacionamiento auto',
                color: 'azul',
                titulo: estacionamiento.nombre,
                descripcion: 'Dejá tu vehículo acá antes de seguir a pie hasta el punto de interés.',
                maxWidth: 220,
            });
            marker.bindPopup(popupContent, { className: 'modern-leaflet-popup', closeButton: true });
            markersPorTipo[tipo].push(marker);
        });
}
