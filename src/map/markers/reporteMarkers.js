/* ==========================================
   PINES DE REPORTES COMUNITARIOS - src/map/markers/reporteMarkers.js
   Extraído de firebaseService.js (Paso 4 del plan de modularización):
   dibuja los pines de "reportes" en el mapa de Leaflet. Sin nada de
   Firestore acá — eso vive en data/reportesRepo.js.
   ========================================== */
import { state } from '../../core/store.js';
import { crearPopupHTML } from '../popups/popupBuilder.js';

let reportMarkersGroup = [];

export function pintarReportesEnMapa(listaReportes) {
    const mapa = state.map;
    if (!mapa) return;

    reportMarkersGroup.forEach(marker => mapa.removeLayer(marker));
    reportMarkersGroup = [];

    listaReportes.forEach(reporte => {
        if (!reporte.lat || !reporte.lng) return;

        const reporteIcon = L.divIcon({
            className: 'custom-map-pin',
            html: `<div style="background: #ff3b30; width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(255,59,48,0.4); border: 2.5px solid white;"><span style="transform: rotate(45deg); font-size: 18px;">⚠️</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 38],
            popupAnchor: [0, -36]
        });

        const marker = L.marker([reporte.lat, reporte.lng], { icon: reporteIcon, zIndexOffset: 600 }).addTo(mapa);
        reportMarkersGroup.push(marker);

        const popupContent = crearPopupHTML({
            badgeTexto: `⚠️ ${reporte.tipo || 'Reporte'}`,
            color: 'rojo',
            descripcion: reporte.descripcion || 'Sin descripción.',
        });

        marker.bindPopup(popupContent, { className: 'modern-leaflet-popup', closeButton: true });
    });
}
