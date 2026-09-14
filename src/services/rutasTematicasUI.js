/* ==========================================
   UI DE RUTAS TEMÁTICAS - src/services/rutasTematicasUI.js
   Arma las "playlist cards" en Explorar (RUTAS_PRECARGADAS, ver
   core/rutasTematicas.js) y conecta cada una con la vista de mapa: al
   tocarla, cambia a la pestaña Mapa y dibuja la línea + pines numerados
   (rutaTematicaRenderer.js) resolviendo lat/lng de cada lugar contra
   state.lugares por nombre.
   ========================================== */
import { state } from '../core/store.js';
import { showToast } from '../utils/helpers.js';
import { RUTAS_PRECARGADAS } from '../core/rutasTematicas.js';
import { dibujarRutaTematica } from '../map/routing/rutaTematicaRenderer.js';

export function renderRutasTematicas() {
    const contenedor = document.getElementById('rutas-tematicas-container');
    if (!contenedor) return;

    contenedor.innerHTML = RUTAS_PRECARGADAS.map((ruta) => {
        const miniaturas = ruta.lugares.slice(0, 3).map((lugar, i) => `
            <img class="ruta-thumb ruta-thumb-${i + 1}" src="${lugar.imagen}" alt="">
        `).join('');

        return `
            <button class="ruta-card" data-ruta-id="${ruta.id}">
                <div class="ruta-card-thumbs">
                    ${miniaturas}
                    <span class="ruta-card-count">${ruta.lugares.length} lugares</span>
                </div>
                <div class="ruta-card-body">
                    <h4 class="ruta-card-title">${ruta.titulo}</h4>
                    <div class="ruta-card-creator">
                        <div class="ruta-creator-avatar" style="background-image:url('${ruta.avatarCreador}')"></div>
                        <span>por @${ruta.creador}</span>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    contenedor.querySelectorAll('.ruta-card').forEach((card) => {
        card.addEventListener('click', () => abrirRutaTematicaEnMapa(card.dataset.rutaId));
    });
}

function abrirRutaTematicaEnMapa(idRuta) {
    const ruta = RUTAS_PRECARGADAS.find((r) => r.id === idRuta);
    if (!ruta) return;

    // Resuelve cada nombre contra state.lugares (ya cargado por fetchLugares
    // al iniciar la app); si algún nombre no matchea, se lo salta en vez de
    // romper toda la ruta.
    const lugaresConCoords = ruta.lugares
        .map((l) => state.lugares.find((lugar) => lugar.nombre === l.nombre))
        .filter(Boolean)
        .map((lugar) => ({ nombre: lugar.nombre, lat: lugar.lat, lng: lugar.lng }));

    if (lugaresConCoords.length < 2) {
        showToast('⚠️ No pudimos armar esta ruta en el mapa');
        return;
    }

    document.querySelector('.tab-btn[data-tab="map"]')?.click();

    setTimeout(() => {
        if (!state.map) return;
        dibujarRutaTematica(state.map, lugaresConCoords);
        showToast(`🗺️ Mostrando "${ruta.titulo}" en el mapa`);
    }, 350);
}
