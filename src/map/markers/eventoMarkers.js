/* ==========================================
   PINES DE EVENTOS - src/map/markers/eventoMarkers.js
   Extraído de firebaseService.js (Paso 4 del plan de modularización):
   dibuja los pines de "eventos" en el mapa de Leaflet. Sin nada de
   Firestore acá — eso vive en data/eventosRepo.js.
   ========================================== */
import { state } from '../../core/store.js';
import { crearPopupHTML, wireBotonComoLlegar } from '../popups/popupBuilder.js';
import { formatearFechaEvento, escapeHTML } from '../../utils/helpers.js';

let eventMarkersGroup = [];

export function pintarEventosEnMapa(listaEventos) {
    const mapa = state.map;
    if (!mapa) return;

    eventMarkersGroup.forEach(marker => mapa.removeLayer(marker));
    eventMarkersGroup = [];

    listaEventos.forEach(evento => {
        if (!evento.lat || !evento.lng) return;

        const eventoIcon = L.divIcon({
            className: 'custom-map-pin',
            html: `<div style="background: #af52de; width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(175,82,222,0.4); border: 2.5px solid white;"><span style="transform: rotate(45deg); font-size: 18px;">🎉</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 38],
            popupAnchor: [0, -36]
        });

        const marker = L.marker([evento.lat, evento.lng], { icon: eventoIcon, zIndexOffset: 500 }).addTo(mapa);
        eventMarkersGroup.push(marker);

        const fechaTexto = formatearFechaEvento(evento.fechaInicio, evento.fechaFin);
        const btnId = `btn-ruta-evento-${evento.id}`;

        const popupContent = crearPopupHTML({
            badgeTexto: '🎉 Evento',
            color: 'violeta',
            titulo: evento.nombre,
            // evento.horario/evento.lugar no pasan por crearPopupHTML (van en
            // extraHtml, que esa función no escapa por venir armado acá), así
            // que se escapan en el origen — misma razón que titulo/descripcion.
            extraHtml: `
                <p class="popup-meta popup-meta--violeta">📅 ${fechaTexto} · ${escapeHTML(evento.horario || '')}</p>
                <p class="popup-meta">📍 ${escapeHTML(evento.lugar || '')}</p>`,
            descripcion: evento.descripcion || '',
            botonId: btnId,
            maxWidth: 250,
        });

        marker.bindPopup(popupContent, {
            className: 'modern-leaflet-popup',
            closeButton: true,
            // Igual que en los popups de lugares: lo corremos a la izquierda
            // del pin para que no quede tapado por los botones flotantes.
            offset: [-120, 0]
        });

        wireBotonComoLlegar(marker, btnId, evento.lat, evento.lng, evento.nombre);
    });
}

// Usado por irAEvento (firebaseService.js) para encontrar el marker ya
// pintado y abrirle el popup, en vez de crear uno nuevo.
export function buscarMarkerEvento(lat, lng) {
    return eventMarkersGroup.find(m => {
        const pos = m.getLatLng();
        return pos.lat === lat && pos.lng === lng;
    });
}
