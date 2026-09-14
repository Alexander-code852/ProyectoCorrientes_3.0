/* ==========================================
   ESTADO DE CONEXIÓN - src/utils/offlineStatus.js
   Muestra el banner #offline-banner (ver index.html) y deshabilita los
   controles marcados con [data-requiere-red] (ej. el FAB del chat IA, que
   necesita pegarle a Gemini) mientras no hay conexión. La navegación por
   datos ya cargados (mapa con teselas cacheadas, favoritos guardados)
   sigue andando: esto no bloquea nada de eso.
   ========================================== */

export function initEstadoConexion() {
    aplicarEstado(navigator.onLine);
    window.addEventListener('online', () => aplicarEstado(true));
    window.addEventListener('offline', () => aplicarEstado(false));
}

function aplicarEstado(hayConexion) {
    document.getElementById('offline-banner')?.classList.toggle('hidden', hayConexion);

    document.querySelectorAll('[data-requiere-red]').forEach((el) => {
        if ('disabled' in el) el.disabled = !hayConexion;
        el.classList.toggle('offline-disabled', !hayConexion);
    });
}
