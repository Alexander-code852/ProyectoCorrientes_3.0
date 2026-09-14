/* ==========================================
   GESTOR DE MAPA - src/map/mapManager.js
   ========================================== */
import { state } from '../core/store.js';
import { initAddPlaceOnClick } from './addPlaceManager.js';
import { showToast } from '../utils/helpers.js';

let userMarker = null;
let watchId = null;

// Las dos TileLayer que alterna el checkbox "Vista satelital" del panel de
// capas (ver alternarVistaSatelital más abajo e index.html #layer-panel).
// Referencias a nivel de módulo porque se crean una sola vez y se agregan/
// sacan del mapa según corresponda -crear una L.tileLayer nueva en cada
// toggle pegaría de nuevo contra el servidor de tiles innecesariamente.
let capaBase = null;
let capaSatelital = null;

export function initMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement || typeof L === "undefined") return;

    // Inicializar el mapa centrado en Corrientes Capital
    state.map = L.map('map', { zoomControl: false }).setView([-27.4692, -58.8306], 14);

    // Capa de mapa base (OpenStreetMap)
    capaBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);

    // Activar la funcionalidad de agregar lugares al hacer clic en el mapa
    initAddPlaceOnClick();

    // La barra superior (buscador + pills de filtro) es hermana de #map, así que
    // vive en un contexto de apilamiento distinto al del popup de Leaflet: por más
    // que el pane de popups tenga z-index alto, nunca puede superar a un elemento
    // fuera de #map (el z-index de #map "encierra" todo lo de adentro). La única
    // forma real de que el popup quede siempre arriba es ocultar la barra mientras
    // haya un popup abierto, igual que ya se hace con la UI durante la navegación.
    state.map.on('popupopen', () => {
        document.querySelector('.map-top-bar')?.style.setProperty('display', 'none', 'important');
    });
    state.map.on('popupclose', () => {
        document.querySelector('.map-top-bar')?.style.removeProperty('display');
    });

    // Configurar botón GPS si existe
    const btnGps = document.getElementById("btn-gps");
    if (btnGps) {
        btnGps.addEventListener("click", () => {
            iniciarGPS();
        });
    }
}

export function iniciarGPS() {
    if (!navigator.geolocation) {
        showToast("⚠️ Tu navegador no soporta geolocalización");
        return;
    }
    if (!state.map) return;

    // Obtener la posición inicial una vez
    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // flyTo en vez de setView: anima el paneo+zoom en vez de saltar de
        // golpe -es la única llamada de esta función pensada para un click
        // deliberado del botón; watchPosition (abajo) solo reposiciona el
        // marcador, no vuelve a mover la cámara en cada actualización.
        state.map.flyTo([lat, lng], 16, { duration: 1.2 });
        actualizarMarcadorUsuario(lat, lng);
    }, (error) => {
        console.error("Error al obtener la ubicación GPS inicial:", error);
        // PERMISSION_DENIED (código 1) es el caso que pide el usuario
        // explícitamente; los otros dos (POSITION_UNAVAILABLE, TIMEOUT)
        // también son accionables desde la UI, así que se avisan igual.
        if (error.code === error.PERMISSION_DENIED) {
            showToast("⚠️ Activá el permiso de ubicación para usar esta función");
        } else {
            showToast("⚠️ No pudimos obtener tu ubicación. Intentá de nuevo");
        }
    }, { enableHighAccuracy: true });

    // Rastrear posición en tiempo real si el navegador lo soporta
    if (watchId === null) {
        watchId = navigator.geolocation.watchPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            actualizarMarcadorUsuario(lat, lng);
        }, (error) => {
            console.error("Error en el seguimiento GPS:", error);
        }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 });
    }
}

function actualizarMarcadorUsuario(lat, lng) {
    if (!state.map) return;

    // Mantenemos siempre en el store la última posición real conocida del usuario
    state.userCoords = { lat, lng };

    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        // Crear un marcador personalizado para la posición actual del usuario
        const userIcon = L.divIcon({
            className: 'user-gps-marker',
            html: `
                <div class="user-gps-pulse"></div>
                <div class="user-gps-dot"></div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        userMarker = L.marker([lat, lng], { icon: userIcon, isUserLocation: true, zIndexOffset: 1000 }).addTo(state.map);
    }
}

// Conectado al checkbox "🛰️ Vista satelital" del panel de capas (ver
// src/ui/events.js, listener de .layer-checkbox). Tiles públicos de Esri
// World Imagery -no piden API key para este volumen de uso-, mismo patrón
// que la capa base de OpenStreetMap: se crea una sola vez y se reutiliza.
export function alternarVistaSatelital(activar) {
    if (!state.map || !capaBase) return;

    if (activar) {
        if (!capaSatelital) {
            capaSatelital = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 19, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' }
            );
        }
        state.map.removeLayer(capaBase);
        capaSatelital.addTo(state.map);
    } else {
        if (capaSatelital) state.map.removeLayer(capaSatelital);
        capaBase.addTo(state.map);
    }
}