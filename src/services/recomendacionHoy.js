/* ==========================================
   RECOMENDACIÓN DEL DÍA - src/services/recomendacionHoy.js
   ========================================== */
// Tarjeta "Recomendado para hoy" (index.html: #recomendacion-hoy-card).
// Trae una lista de 3-5 lugares acordes al momento del día desde
// backend/recomendaciones/api.py (mismo backend Python del Asistente
// Local, ver asistenteLocalIA.js) y los va rotando en la tarjeta sin
// recargar la página. El botón azul abre en el mapa el lugar que esté
// visible en ese instante.
import { state } from '../core/store.js';
import { buscarMarkerLugar } from '../map/markers/lugarMarkers.js';
import { crearPopupHTML, wireBotonComoLlegar } from '../map/popups/popupBuilder.js';

// Mismo criterio que ASISTENTE_API_URL en asistenteLocalIA.js: en
// producción se asume un reverse proxy que expone el backend bajo el mismo
// origen; en desarrollo local (Live Server, "npx serve", etc.) se apunta
// directo al uvicorn local.
const RECOMENDACIONES_API_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8000/api/recomendaciones-hoy'
    : '/api/recomendaciones-hoy';

const ROTACION_MS = 10000;
const DURACION_FADE_MS = 280; // debe matchear la transición de .suggestion-text en _map.css

// Si el backend no está disponible, la tarjeta no queda vacía: usamos 3
// lugares reales ya cargados en LUGARES_PRECARGADOS (mismas coordenadas que
// sus pines en el mapa, ver data/lugaresRepo.js) para que el botón azul
// siga funcionando aunque no haya backend Python corriendo.
const RECOMENDACIONES_FALLBACK = [
    { id_lugar: 'fallback-costanera', titulo: 'Costanera General San Martín', descripcion: 'Hermosa vista al río', coordenadas: { lat: -27.4585, lng: -58.8681 } },
    { id_lugar: 'fallback-puente', titulo: 'Puente General Belgrano', descripcion: 'Ícono de la ciudad, ideal para una foto', coordenadas: { lat: -27.4705, lng: -58.8471 } },
    { id_lugar: 'fallback-shopping', titulo: 'Centenario Shopping', descripcion: 'Gastronomía y compras bajo techo', coordenadas: { lat: -27.4832, lng: -58.8120 } },
];

let recomendaciones = [];
let indiceActual = 0;
let intervaloId = null;
let markerActivo = null; // marker efímero para lugares que no tienen pin propio en el mapa

export async function initRecomendacionHoy() {
    const card = document.getElementById('recomendacion-hoy-card');
    const textoEl = document.getElementById('recomendacion-hoy-texto');
    const btn = document.getElementById('recomendacion-hoy-btn');
    if (!card || !textoEl || !btn) return;

    recomendaciones = await cargarRecomendaciones();
    if (recomendaciones.length === 0) return; // sin fallback ni backend, no mostramos la tarjeta vacía

    card.hidden = false;
    pintarActual(textoEl);

    if (intervaloId) clearInterval(intervaloId);
    intervaloId = setInterval(() => avanzar(textoEl), ROTACION_MS);

    btn.addEventListener('click', () => irAlMapaConLugarActivo());
}

async function cargarRecomendaciones() {
    try {
        const respuesta = await fetch(RECOMENDACIONES_API_URL);
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const data = await respuesta.json();
        const lista = data.recomendaciones || [];
        return lista.length > 0 ? lista : RECOMENDACIONES_FALLBACK;
    } catch (error) {
        console.error('Recomendación del día: no se pudo conectar con el backend, uso fallback local.', error);
        return RECOMENDACIONES_FALLBACK;
    }
}

function avanzar(textoEl) {
    // Fade-out: agrega la clase, espera a que termine la transición y recién
    // ahí cambia el texto y hace fade-in sacándola. Un solo elemento
    // animado (más simple que animar dos <p> superpuestos) alcanza para el
    // efecto pedido porque el cambio de contenido pasa mientras está invisible.
    textoEl.classList.add('suggestion-text--saliendo');
    setTimeout(() => {
        indiceActual = (indiceActual + 1) % recomendaciones.length;
        pintarActual(textoEl);
        textoEl.classList.remove('suggestion-text--saliendo');
    }, DURACION_FADE_MS);
}

function pintarActual(textoEl) {
    const lugar = recomendaciones[indiceActual];
    textoEl.textContent = `${lugar.titulo} • ${lugar.descripcion}`;
}

function irAlMapaConLugarActivo() {
    const lugar = recomendaciones[indiceActual];
    if (!lugar || !state.map) return;

    const { lat, lng } = lugar.coordenadas;

    document.querySelector('.tab-btn[data-tab="map"]')?.click();

    setTimeout(() => {
        state.map.flyTo([lat, lng], 17, { duration: 1.2 });

        // Si el lugar recomendado ya tiene un pin real en el mapa (mismas
        // coordenadas exactas que un lugar de state.lugares), reusamos ese
        // marker/popup. Si no (dataset de recomendaciones propio, sin pin
        // plantado), armamos uno efímero solo para esta interacción.
        const markerExistente = buscarMarkerLugar(lat, lng);
        if (markerExistente) {
            if (markerActivo) { state.map.removeLayer(markerActivo); markerActivo = null; }
            markerExistente.openPopup();
            return;
        }

        mostrarMarkerEfimero(lugar, lat, lng);
    }, 300);
}

function mostrarMarkerEfimero(lugar, lat, lng) {
    if (markerActivo) state.map.removeLayer(markerActivo);

    const btnId = `btn-ruta-recomendacion-${lugar.id_lugar}`;
    const popupContent = crearPopupHTML({
        badgeTexto: '✨ Recomendado para hoy',
        color: 'azul',
        titulo: lugar.titulo,
        descripcion: lugar.descripcion,
        botonId: btnId,
    });

    markerActivo = L.marker([lat, lng]).addTo(state.map);
    markerActivo.bindPopup(popupContent, { className: 'modern-leaflet-popup', closeButton: true, offset: [-115, 0] });
    wireBotonComoLlegar(markerActivo, btnId, lat, lng, lugar.titulo);
    markerActivo.openPopup();
}
