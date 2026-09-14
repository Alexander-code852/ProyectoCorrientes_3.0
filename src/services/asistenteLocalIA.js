/* ==========================================
   ASISTENTE LOCAL INTELIGENTE - src/services/asistenteLocalIA.js
   ========================================== */
// Barra de búsqueda en lenguaje natural del mapa: manda la consulta del
// usuario a un backend Python (ver backend/asistente_ia/) que la interpreta
// con un LLM, la cruza con el clima actual y devuelve lugares reales de la
// base de datos. Ese backend es un servicio aparte — no corre dentro de
// este repo estático (ver CLAUDE.md) — acá solo se orquesta el fetch y los
// estados visuales; el resultado final ("Ver en el mapa") reutiliza el
// mismo mecanismo data-ir-lugar que ya usa el feed de Explorar
// (src/ui/events.js -> irALugarPorNombre).
import { state } from '../core/store.js';
import { escapeHTML } from '../utils/helpers.js';

// Apunta al endpoint de backend/asistente_ia/api.py. En producción se asume
// que ese backend queda expuesto bajo el mismo origen como "/api/asistente"
// (reverse proxy / Cloud Run / Cloud Function delante de index.html). En
// desarrollo local (Live Server, "npx serve", etc.) no hay ese proxy, así
// que si el frontend corre en localhost apuntamos directo al uvicorn local
// (backend/asistente_ia/api.py, puerto 8000 por convención en este repo).
const ASISTENTE_API_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8000/api/asistente'
    : '/api/asistente';

// Rotación puramente visual: el backend responde en una sola llamada (no hay
// streaming de progreso real), pero ir cambiando el texto transmite mejor lo
// que está pasando ("interpretando" -> "clima" -> "buscando") que dejar un
// "Cargando..." fijo todo el tiempo que tarda la consulta al LLM + la API de
// clima + la query SQL.
const ETAPAS_PROCESANDO = [
    '🧠 Interpretando tu consulta...',
    '🌦️ Analizando el clima local...',
    '📍 Buscando en el mapa...'
];

export function initAsistenteLocal() {
    const btnAbrir = document.getElementById('btn-asistente-local-float');
    const panel = document.getElementById('asistente-local-panel');
    const btnCerrar = document.getElementById('btn-cerrar-asistente-local');
    const form = document.getElementById('form-asistente-local');
    const input = document.getElementById('asistente-local-input');
    const estadoEl = document.getElementById('asistente-local-estado');
    const resultadosEl = document.getElementById('asistente-local-resultados');

    if (!btnAbrir || !panel || !form || !input || !estadoEl || !resultadosEl) return;

    btnAbrir.addEventListener('click', () => {
        panel.classList.add('active');
        setTimeout(() => input.focus(), 300);
    });

    btnCerrar?.addEventListener('click', () => panel.classList.remove('active'));

    // Tocar una tarjeta de recomendación cierra el panel: data-ir-lugar ya
    // centra el mapa y abre el popup del lugar (listener delegado en events.js).
    resultadosEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-ir-lugar]')) panel.classList.remove('active');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = input.value.trim();
        if (!mensaje) return;

        resultadosEl.innerHTML = '';
        mostrarProcesando(estadoEl);

        try {
            const data = await consultarAsistente(mensaje);
            mostrarResultados(estadoEl, resultadosEl, data);
        } catch (error) {
            mostrarError(estadoEl, error);
        }
    });
}

function mostrarProcesando(estadoEl) {
    let paso = 0;
    estadoEl.classList.remove('hidden', 'asistente-local-estado--error');
    estadoEl.innerHTML = `<span class="asistente-local-spinner"></span><span>${ETAPAS_PROCESANDO[0]}</span>`;

    const intervalo = setInterval(() => {
        paso = (paso + 1) % ETAPAS_PROCESANDO.length;
        const textoEl = estadoEl.querySelector('span:last-child');
        if (textoEl) textoEl.textContent = ETAPAS_PROCESANDO[paso];
    }, 1400);

    estadoEl.dataset.intervaloId = intervalo;
}

function detenerProcesando(estadoEl) {
    clearInterval(Number(estadoEl.dataset.intervaloId));
}

// El LLM + la API de clima + la query SQL pueden tardar; sin timeout, una
// respuesta colgada deja el fetch pendiente indefinidamente y el usuario
// nunca ve ni el estado de error. 15s cubre el peor caso normal.
const TIMEOUT_MS = 15000;

async function consultarAsistente(mensaje) {
    const coords = state.userCoords || {};
    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(ASISTENTE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensaje,
                lat: coords.lat ?? null,
                lon: coords.lng ?? null
            }),
            signal: controlador.signal
        });
    } catch (error) {
        // Acá caen: backend caído/no levantado (TypeError: Failed to fetch),
        // CORS bloqueado por el navegador (también TypeError, sin más detalle
        // por seguridad del propio browser) y el abort por timeout (AbortError).
        if (error.name === 'AbortError') {
            throw new Error(`El asistente no respondió en ${TIMEOUT_MS / 1000}s (timeout).`);
        }
        throw new Error(`No se pudo conectar con ${ASISTENTE_API_URL}: ${error.message}`);
    } finally {
        clearTimeout(timeoutId);
    }

    if (!respuesta.ok) {
        // El backend (api.py) siempre devuelve JSON con "detail" en errores
        // (HTTPException o el exception_handler catch-all) — lo mostramos
        // en vez de un mensaje genérico para poder distinguir 400 (consulta
        // mal formada) de 502 (falló el LLM) de 500 (error interno).
        let detalle = `HTTP ${respuesta.status}`;
        try {
            const cuerpoError = await respuesta.json();
            if (cuerpoError.detail) detalle = cuerpoError.detail;
        } catch {
            // el cuerpo no era JSON (ej. 404 de un servidor estático sin
            // esa ruta, o un proxy intermedio) — nos quedamos con el status
        }
        throw new Error(detalle);
    }

    return respuesta.json();
}

function mostrarResultados(estadoEl, resultadosEl, data) {
    detenerProcesando(estadoEl);
    const lugares = data.recomendaciones || [];

    if (lugares.length === 0) {
        estadoEl.classList.add('asistente-local-estado--error');
        estadoEl.innerHTML = '<span>😕 No encontré lugares que encajen con eso ahora mismo. Probá describirlo distinto.</span>';
        return;
    }

    estadoEl.classList.add('hidden');

    const climaTexto = (data.clima && data.clima.descripcion)
        ? `${Math.round(data.clima.temperatura)}°C, ${escapeHTML(data.clima.descripcion)}`
        : null;

    resultadosEl.innerHTML = `
        ${climaTexto ? `<p class="asistente-local-clima">🌤️ Ahora mismo: ${climaTexto}</p>` : ''}
        ${lugares.map(lugarACardHTML).join('')}
    `;
}

function lugarACardHTML(lugar) {
    const nombre = escapeHTML(lugar.nombre);
    const descripcion = escapeHTML(lugar.descripcion || '');
    return `
        <article class="asistente-local-card" data-ir-lugar="${nombre}">
            <div class="asistente-local-card-info">
                <h4>${nombre}</h4>
                <p>${descripcion}</p>
            </div>
            <ion-icon name="chevron-forward-outline"></ion-icon>
        </article>
    `;
}

function mostrarError(estadoEl, error) {
    detenerProcesando(estadoEl);
    estadoEl.classList.remove('hidden');
    estadoEl.classList.add('asistente-local-estado--error');
    estadoEl.innerHTML = '<span>⚠️ No se pudo conectar con el asistente. Intentá de nuevo en un momento.</span>';
    console.error('Asistente Local IA:', error);
}
