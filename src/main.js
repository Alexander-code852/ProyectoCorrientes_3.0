/* ==========================================
   RUTA CORRENTINA - ULTIMATE EDITION v14.0
   ========================================== */

import { state } from './core/store.js';
import { initPWA } from './utils/pwa.js';
import { setupHeaderDate } from './utils/helpers.js';
import { cargarFavoritosLocal } from './utils/favoritosStore.js';
import { initEstadoConexion } from './utils/offlineStatus.js';

import { initMap, iniciarGPS } from './map/mapManager.js';
import { initReportButton } from './map/reportManager.js';
import { initTheme, cambiarTab } from './ui/uiManager.js';

import { auth } from './config/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { fetchLugares, cargarReportesComunitarios, cargarPerfil, cargarEventos } from './services/firebaseService.js';
import { renderRutasTematicas } from './services/rutasTematicasUI.js';
import { initAsistenteLocal } from './services/asistenteLocalIA.js';
import { initRecomendacionHoy } from './services/recomendacionHoy.js';
import { cargarYPintarLugaresOsm } from './map/markers/lugaresOsmMarkers.js';

import { initEventListeners } from './ui/events.js';
import { initAuthUI } from './ui/authUI.js';
import { initChatUI } from './services/geminiAi.js';
import { initJuegos } from './juegos/juegosManager.js';

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    initPWA();
    setupHeaderDate();
    cargarFavoritosLocal();
    initEstadoConexion();
    registrarServiceWorker();

    setTimeout(() => {
        const splash = document.getElementById('splash-screen'); 
        if(splash) { 
            splash.style.opacity = '0'; 
            setTimeout(() => { splash.remove(); }, 600); 
        } 
    }, 1500);

    initTheme();

    initEventListeners();
    initAuthUI();
    initChatUI();
    initJuegos();
    initAsistenteLocal();

    // Configurar eventos para la barra de navegación inferior
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            if (tabName) {
                cambiarTab(tabName);
            }

            // Animación de rebote del ícono al tocarlo (ver @keyframes
            // tab-bounce/tab-bounce-active en _components.css). Se saca la
            // clase antes de agregarla de nuevo por si se toca dos veces
            // seguido muy rápido, para que la animación siempre reinicie.
            button.classList.remove('tap-bounce');
            void button.offsetWidth; // fuerza reflow para reiniciar la animación
            button.classList.add('tap-bounce');
        });

        button.addEventListener('animationend', () => {
            button.classList.remove('tap-bounce');
        });
    });

    window.addEventListener('resize', () => { 
        if(state.map) setTimeout(() => state.map.invalidateSize(), 300); 
    });
    
    // Control de Sesión con el ID extraído correctamente
    onAuthStateChanged(auth, async (user) => {
        state.currentUser = user;
        if (user) {
            await cargarPerfil(user.uid);
        }
    });

    try {
        // 1. Inicializar el mapa primero para que state.map esté disponible
        initMap();
        initReportButton();

        // 2. Descargar y pintar los lugares precargados y de Firebase de manera limpia
        await Promise.all([
            fetchLugares(),
            cargarReportesComunitarios(),
            cargarEventos(),
            initRecomendacionHoy(),
            cargarYPintarLugaresOsm()
        ]);

        // Depende de que state.lugares ya esté cargado (fetchLugares arriba)
        // para poder resolver lat/lng de cada lugar de la ruta por nombre.
        renderRutasTematicas();

        iniciarGPS();
    } catch (error) {
        console.error("Error cargando datos iniciales:", error);
    }
}

// sw.js existe en el repo hace rato pero nada lo registraba (quedó huérfano
// tras sacar el <script> que lo hacía en una versión previa de la app) — sin
// esto, ninguna de las cachés de sw.js (assets, teselas, favoritos) se
// activa nunca, sin importar qué tan bien esté escrito el archivo.
function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('No se pudo registrar el service worker:', error);
    });
}