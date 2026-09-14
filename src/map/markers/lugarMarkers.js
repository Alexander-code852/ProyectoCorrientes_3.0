/* ==========================================
   PINES DE LUGARES - src/map/markers/lugarMarkers.js
   Extraído de firebaseService.js (Paso 4 del plan de modularización):
   dibuja los pines de "lugares" en el mapa de Leaflet. Sin nada de
   Firestore acá — eso vive en data/lugaresRepo.js.
   ========================================== */
import { state } from '../../core/store.js';
import { crearPopupHTML, wireBotonComoLlegar } from '../popups/popupBuilder.js';

let markersGroup = [];

export function pintarLugaresEnMapa(listaLugares) {
    const mapa = state.map;
    if (!mapa) return;

    markersGroup.forEach(marker => mapa.removeLayer(marker));
    markersGroup = [];

    listaLugares.forEach(lugar => {
        const lat = lugar.lat || lugar.latitude;
        const lng = lugar.lng || lugar.longitude;

        if (lat && lng) {
            let emoji = '📍';
            if (lugar.categoria === 'playas') emoji = '🏖️';
            if (lugar.categoria === 'gastronomia') emoji = '🍔';
            if (lugar.categoria === 'cultura') emoji = '🏛️';
            if (lugar.categoria === 'naturaleza') emoji = '🌿';

            const customIcon = L.divIcon({
                className: 'custom-map-pin',
                html: `<div style="background: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.2); font-size: 18px; border: 2.5px solid #007aff;">${emoji}</div>`,
                iconSize: [38, 38],
                iconAnchor: [19, 19],
                popupAnchor: [0, -22]
            });

            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapa);
            markersGroup.push(marker);

            const popupContent = crearPopupHTML({
                badgeTexto: lugar.categoria || 'Punto de interés',
                color: 'azul',
                titulo: lugar.nombre || 'Lugar',
                descripcion: lugar.descripcion || 'Sin descripción disponible.',
                botonId: `btn-ruta-${lugar.id || lat}`,
            });

            marker.bindPopup(popupContent, {
                className: 'modern-leaflet-popup',
                closeButton: true,
                // Por defecto Leaflet centra el popup sobre el pin; lo corremos
                // hacia la izquierda para que no quede tapado por los botones
                // flotantes de la derecha (GPS, capas, reportar).
                offset: [-115, 0]
            });

            wireBotonComoLlegar(marker, `btn-ruta-${lugar.id || lat}`, lat, lng, lugar.nombre);
        }
    });
}

// Usado por irALugarPorNombre (firebaseService.js) para encontrar el marker
// ya pintado y abrirle el popup, en vez de crear uno nuevo.
export function buscarMarkerLugar(lat, lng) {
    return markersGroup.find(m => {
        const pos = m.getLatLng();
        return pos.lat === lat && pos.lng === lng;
    });
}
