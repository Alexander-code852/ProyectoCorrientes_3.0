/* ==========================================
   FAVORITOS OFFLINE - src/utils/favoritosStore.js
   Persiste state.favoritos en localStorage y cachea la foto de portada de
   cada lugar marcado, para que el feed de favoritos no se rompa sin conexión.

   Nota: toggleFavorite() no existía en ningún lado del código — templates.js
   ya la llamaba vía onclick="toggleFavorite(...)" (ficha de lugar) pero
   nunca estuvo definida ni expuesta globalmente (ver CLAUDE.md, "rough
   edges"). Se expone acá en window porque los onclick inline del HTML no
   pueden ver exports de módulos ES — mismo motivo por el que abrirFichaNombre/
   cerrarFicha siguen rotos hoy (fuera del alcance de este cambio).
   ========================================== */
import { state } from '../core/store.js';

const CLAVE_FAVORITOS = 'rc_favoritos_v1';
const CACHE_IMAGENES_FAVORITOS = 'rc-favoritos-img-v1';

export function cargarFavoritosLocal() {
    try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE_FAVORITOS));
        state.favoritos = Array.isArray(guardados) ? guardados : [];
    } catch (error) {
        console.warn('No se pudieron leer los favoritos guardados:', error);
        state.favoritos = [];
    }
}

function guardarFavoritosLocal() {
    try {
        localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(state.favoritos));
    } catch (error) {
        // localStorage lleno o bloqueado (modo privado): no es motivo para
        // romper la interacción, el estado en memoria sigue funcionando.
        console.warn('No se pudo guardar el favorito localmente:', error);
    }
}

export function esFavorito(nombreLugar) {
    return state.favoritos.includes(nombreLugar);
}

// Expuesta en window: la llaman los onclick="toggleFavorite('...')" ya
// existentes en templates.js.
window.toggleFavorite = function toggleFavorite(nombreLugar) {
    const yaEsFavorito = esFavorito(nombreLugar);
    state.favoritos = yaEsFavorito
        ? state.favoritos.filter((n) => n !== nombreLugar)
        : [...state.favoritos, nombreLugar];

    guardarFavoritosLocal();
    if (!yaEsFavorito) cachearImagenDeLugar(nombreLugar);

    // Cualquier vista que muestre el corazón/contador de favoritos escucha
    // este evento en vez de que este módulo conozca el DOM de cada una.
    document.dispatchEvent(new CustomEvent('favoritos-actualizados'));
};

async function cachearImagenDeLugar(nombreLugar) {
    if (!('caches' in window)) return;

    const lugar = state.lugares.find((l) => l.nombre === nombreLugar);
    if (!lugar?.imagen) return; // los lugares precargados hoy no traen foto propia

    try {
        const cache = await caches.open(CACHE_IMAGENES_FAVORITOS);
        await cache.add(lugar.imagen);
    } catch (error) {
        console.warn('No se pudo cachear la foto del favorito:', error);
    }
}
