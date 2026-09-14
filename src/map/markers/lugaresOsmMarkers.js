/* ==========================================
   PINES DE LUGARES OSM - src/map/markers/lugaresOsmMarkers.js
   ========================================== */
// Trae backend/importador_lugares/api.py (GET /api/lugares-osm, GeoJSON) y
// pinta los pines en el mapa. Mismo estilo visual que lugarMarkers.js /
// eventoMarkers.js, en un módulo aparte porque esta fuente de datos es
// independiente (SQLite propia, importada desde OpenStreetMap -ver
// backend/importador_lugares/extraer_overpass.py-, no Firestore).
import { state } from '../../core/store.js';
import { crearPopupHTML, wireBotonComoLlegar } from '../popups/popupBuilder.js';

const LUGARES_OSM_API_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8000/api/lugares-osm'
    : '/api/lugares-osm';

const ESTILO_POR_CATEGORIA = {
    gastronomia: { color: '#ff9500', emoji: '🍔' },
    cultura: { color: '#af52de', emoji: '🏛️' },
    alojamiento: { color: '#007aff', emoji: '🛏️' },
    playas: { color: '#34c759', emoji: '🏖️' },
    naturaleza: { color: '#34c759', emoji: '🌳' },
};

let osmMarkersGroup = [];

export async function cargarYPintarLugaresOsm() {
    if (!state.map) return;
    try {
        const respuesta = await fetch(LUGARES_OSM_API_URL);
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const geojson = await respuesta.json();
        pintarLugaresOsm(geojson);
    } catch (error) {
        console.error('Lugares OSM: no se pudieron cargar', error);
    }
}

function pintarLugaresOsm(geojson) {
    const mapa = state.map;
    osmMarkersGroup.forEach(marker => mapa.removeLayer(marker));
    osmMarkersGroup = [];

    (geojson.features || []).forEach((feature) => {
        // GeoJSON define sus coordenadas como [longitud, latitud] (ver RFC
        // 7946) -al revés del [lat, lng] que espera Leaflet en L.marker().
        // Desestructurar así, explícito, es a propósito: pasarle
        // feature.geometry.coordinates directo a L.marker() (sin invertir)
        // es EL bug clásico que tira los pines a miles de km del lugar real
        // -acá no se puede colar sin querer.
        const [lng, lat] = feature.geometry.coordinates;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const props = feature.properties || {};
        const estilo = ESTILO_POR_CATEGORIA[props.categoria] || { color: '#8e8e93', emoji: '📍' };

        const icono = L.divIcon({
            className: 'custom-map-pin',
            html: `<div style="background: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.2); font-size: 18px; border: 2.5px solid ${estilo.color};">${estilo.emoji}</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -22],
        });

        const marker = L.marker([lat, lng], { icon: icono }).addTo(mapa);
        osmMarkersGroup.push(marker);

        const btnId = `btn-ruta-osm-${props.id_lugar}`;
        const popupContent = crearPopupHTML({
            badgeTexto: props.tipo_osm || props.categoria || 'Punto de interés',
            color: 'azul',
            titulo: props.nombre || 'Lugar',
            descripcion: props.direccion || 'Dirección no disponible (dato no cargado en OpenStreetMap).',
            botonId: btnId,
        });

        marker.bindPopup(popupContent, {
            className: 'modern-leaflet-popup',
            closeButton: true,
            offset: [-115, 0],
        });

        wireBotonComoLlegar(marker, btnId, lat, lng, props.nombre);
    });
}
