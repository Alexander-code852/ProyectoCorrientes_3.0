/* ==========================================
   EVENTOS - src/ui/events.js
   ========================================== */
import { filtrarLugaresPorCategoria, irALugarPorNombre } from '../services/firebaseService.js';
import { auth } from '../config/firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { toggleEstacionamientos } from '../map/markers/estacionamientoMarkers.js';
import { alternarVistaSatelital } from '../map/mapManager.js';
import { state } from '../core/store.js';

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

export function initEventListeners() {
    // Escucha global de clics en la interfaz
    document.addEventListener('click', async (e) => {
        // 1. Modo Oscuro con transición degradada (círculo que se expande
        // desde donde se tocó el switch, ver transicionarTema más abajo)
        const darkToggle = e.target.closest('#btn-toggle-dark');
        if (darkToggle) {
            const activarOscuro = !document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', activarOscuro ? 'enabled' : 'disabled');

            // El switch se ve reflejado al toque; el fondo cambia con el degradé.
            document.getElementById('dark-mode-switch')?.classList.toggle('on', activarOscuro);

            transicionarTema(e.clientX, e.clientY, activarOscuro);
        }

        // 2. Abrir Modal de Editar Perfil (misma clase .active que usa
        // cerrarEditarPerfil() en uiManager.js para cerrarlo)
        const editBtn = e.target.closest('#btn-edit-profile-modal');
        if (editBtn) {
            const modalEl = document.getElementById('modal-edit-profile');
            if (modalEl) {
                modalEl.classList.add('active');
                const inputEl = document.getElementById('input-nuevo-nombre');
                if (inputEl) inputEl.focus();
            }
        }

        // 2b. Cerrar Sesión
        const logoutBtn = e.target.closest('#btn-logout');
        if (logoutBtn) {
            try {
                await signOut(auth);
                document.getElementById('auth-container')?.classList.remove('hidden');
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        }

        // 3. Filtro por actividad (pills del mapa: Todos, Playas, Cultura, etc.)
        const filterPill = e.target.closest('.filter-pill');
        if (filterPill) {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            filterPill.classList.add('active');
            filtrarLugaresPorCategoria(filterPill.dataset.category);
        }

        // 4. "Ver en el mapa" (tarjetas de Explorar): ir al lugar en el mapa y
        // dejar abierto su popup con el botón "Cómo llegar" para elegir ruta
        const irALugarBtn = e.target.closest('[data-ir-lugar]');
        if (irALugarBtn) {
            irALugarPorNombre(irALugarBtn.dataset.irLugar);
        }

        // 5b. Panel de capas del mapa (#btn-layer-toggle -> #layer-panel):
        // el botón lo abre/cierra; tocar afuera del panel (y del botón) lo cierra.
        const layerToggleBtn = e.target.closest('#btn-layer-toggle');
        const layerPanel = document.getElementById('layer-panel');
        if (layerToggleBtn) {
            layerPanel?.classList.toggle('hidden');
        } else if (layerPanel && !layerPanel.classList.contains('hidden') && !e.target.closest('#layer-panel')) {
            layerPanel.classList.add('hidden');
        }

        // 5. Botón Instalar App (PWA)
        const installBtn = e.target.closest('#btn-install-app');
        if (installBtn) {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    deferredPrompt = null;
                }
            } else {
                alert('La aplicación ya está instalada o tu navegador no permite la instalación directa desde este botón.');
            }
        }
    });

    // Checkboxes del panel de capas: "Mapa de calor"/"Tráfico en vivo" siguen
    // sin ningún listener (ver comentario en index.html) — acá se conectan
    // "Vista satelital" (alterna la TileLayer base, ver mapManager.js) y
    // los dos de estacionamiento, que pintan pines reales.
    document.addEventListener('change', (e) => {
        const checkbox = e.target.closest('.layer-checkbox');
        if (!checkbox) return;

        if (checkbox.dataset.layer === 'satelital') {
            alternarVistaSatelital(checkbox.checked);
        }
        if (checkbox.dataset.layer === 'estacionamiento-moto') {
            state.activeLayers.estacionamiento = checkbox.checked || document.querySelector('[data-layer="estacionamiento-auto"]')?.checked;
            toggleEstacionamientos('moto', checkbox.checked);
        }
        if (checkbox.dataset.layer === 'estacionamiento-auto') {
            state.activeLayers.estacionamiento = checkbox.checked || document.querySelector('[data-layer="estacionamiento-moto"]')?.checked;
            toggleEstacionamientos('auto', checkbox.checked);
        }
    });
}

// Degradé circular al cambiar de modo claro/oscuro: un círculo TRANSLÚCIDO
// (ver #theme-transition-overlay, opacity 0.45 en _components.css) barre la
// pantalla desde (x, y) mientras el modo real ya cambió por debajo — el
// contenido sigue viéndose todo el tiempo, sólo se ve un tinte pasando por
// encima mientras sus propios colores se acomodan (transition en _base.css).
// El overlay sólo se usa para el efecto visual; nunca tapa nada del todo.
function transicionarTema(x, y, activarOscuro) {
    const overlay = document.getElementById('theme-transition-overlay');

    // El cambio real es inmediato: así el contenido empieza a interpolar sus
    // propios colores ya mismo, en paralelo con el barrido del círculo.
    document.body.classList.toggle('dark-mode', activarOscuro);

    if (!overlay) return;

    const colorEntrante = activarOscuro ? '#000000' : '#ffffff';
    const radioFinal = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    overlay.style.background = colorEntrante;
    overlay.style.transition = 'none';
    overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;

    requestAnimationFrame(() => {
        overlay.style.transition = 'clip-path 0.6s ease';
        overlay.style.clipPath = `circle(${radioFinal}px at ${x}px ${y}px)`;
    });

    overlay.addEventListener('transitionend', function onEnd() {
        overlay.removeEventListener('transitionend', onEnd);
        // Se colapsa de nuevo sin transición, listo para el próximo toque.
        overlay.style.transition = 'none';
        overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    }, { once: true });
}