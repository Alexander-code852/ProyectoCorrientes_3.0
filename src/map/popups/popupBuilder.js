/* ==========================================
   CONSTRUCTOR DE POPUPS DEL MAPA - src/map/popups/popupBuilder.js
   Extraído de firebaseService.js (Paso 1 del plan de modularización):
   arma el HTML de los 3 tipos de popup del mapa (lugar/evento/reporte) y
   conecta el botón "Cómo llegar" que ese HTML genera (Paso 4: se agregó acá
   en vez de en map/markers/*, porque es el botón que este mismo módulo
   construye — wireBotonComoLlegar y crearPopupHTML viven juntos).
   ========================================== */
import { iniciarNavegacionHacia } from '../routing/routingService.js';
import { abrirUber, abrirDiDi } from '../transporte/deepLinks.js';
import { escapeHTML } from '../../utils/helpers.js';

// Ícono "navigation" (estilo Lucide) para el botón "Cómo llegar" de los
// popups — reemplaza el emoji 🧭 por un SVG que hereda el color del texto
// (currentColor) y escala nítido en cualquier densidad de pantalla.
const ICONO_NAVEGACION = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;

// Construye el HTML de los 3 tipos de popup del mapa (lugar/evento/reporte):
// mismo look & feel (badge + título + descripción + botón opcional), con el
// color de acento como modificador de clase (ver .popup-badge--* y
// .popup-btn-primary--* en _map.css). Evita triplicar el marcado inline que
// tenían antes pintarLugaresEnMapa/pintarEventosEnMapa/pintarReportesEnMapa.
export function crearPopupHTML({ badgeTexto, color = 'azul', titulo, extraHtml = '', descripcion, botonId, maxWidth = 240, imagenUrl = null }) {
    // data-requiere-red: calcular la ruta le pega a OSRM (routingService.js),
    // así que src/utils/offlineStatus.js lo deshabilita sin conexión — a
    // diferencia del chat IA, este botón no tiene ningún modo con datos ya
    // guardados al que degradar.
    const boton = botonId ? `
                <button id="${botonId}" class="popup-btn-primary popup-btn-primary--${color}" data-requiere-red>
                    ${ICONO_NAVEGACION}
                    Cómo llegar
                </button>` : '';

    // Uber/DiDi Moto: mismo criterio que el botón de arriba (solo si hay
    // botonId, es decir, solo lugares/eventos — un reporte no necesita
    // pedir un viaje). Los IDs se derivan de botonId en vez de recibir dos
    // parámetros más acá; wireBotonComoLlegar los conecta con los mismos
    // destinoLat/destinoLng/destinoNombre que ya recibe.
    const botonesTransporte = botonId ? `
                <div class="popup-transporte-row">
                    <button id="${botonId}-uber" class="popup-btn-transporte" data-requiere-red>
                        <ion-icon name="car-outline"></ion-icon> Uber
                    </button>
                    <button id="${botonId}-didi" class="popup-btn-transporte popup-btn-transporte--didi" data-requiere-red>
                        <ion-icon name="bicycle-outline"></ion-icon> DiDi Moto
                    </button>
                </div>` : '';

    // badgeTexto/titulo/descripcion pueden venir de texto libre que un
    // usuario escribió (descripción de un reporte, nombre/descripción de un
    // lugar agregado a mano) y llegan tal cual desde Firestore — nunca
    // confiar en eso sin escapar antes de meterlo en innerHTML. extraHtml NO
    // se escapa acá: lo arma el propio código (eventoMarkers.js), no es
    // texto libre de un usuario.
    const badge = `<span class="popup-badge popup-badge--${color}${imagenUrl ? ' popup-badge--sobre-imagen' : ''}">${escapeHTML(badgeTexto)}</span>`;

    // imagenUrl es opcional a propósito: hoy ningún lugar/evento/reporte
    // de Firestore ni LUGARES_PRECARGADOS tiene una URL de foto real -este
    // parámetro queda listo para cuando la haya, sin romper a ningún
    // caller existente (todos siguen armando el popup "de texto" de
    // siempre si no lo pasan).
    const cuerpo = `
            ${titulo ? `<h4 class="popup-title">${escapeHTML(titulo)}</h4>` : ''}
            ${extraHtml}
            <p class="popup-desc">${escapeHTML(descripcion)}</p>
            ${boton}
            ${botonesTransporte}`;

    if (imagenUrl) {
        return `
        <div class="popup-card popup-card--con-imagen" style="max-width: ${maxWidth}px;">
            <div class="popup-media">
                <img class="popup-media-img" src="${escapeHTML(imagenUrl)}" alt="" loading="lazy">
                ${badge}
            </div>
            <div class="popup-body">
                ${cuerpo}
            </div>
        </div>
    `;
    }

    return `
        <div class="popup-card" style="max-width: ${maxWidth}px;">
            ${badge}
            ${cuerpo}
        </div>
    `;
}

// Conecta el botón "Cómo llegar" (+ los de Uber/DiDi, si crearPopupHTML los
// generó) de cualquier popup al servicio correspondiente, para no duplicar
// esta lógica en cada tipo de marcador.
export function wireBotonComoLlegar(marker, btnId, destinoLat, destinoLng, destinoNombre) {
    marker.on('popupopen', () => {
        const btnRuta = document.getElementById(btnId);
        const btnUber = document.getElementById(`${btnId}-uber`);
        const btnDidi = document.getElementById(`${btnId}-didi`);

        // Los tres botones recién existen en el DOM a partir de este momento,
        // así que el listener global de offlineStatus.js (que corrió al
        // cargar la página o en el último online/offline) nunca los vio. Se
        // aplica acá también, con el estado actual de la conexión.
        [btnRuta, btnUber, btnDidi].forEach((btn) => {
            if (btn && !navigator.onLine) {
                btn.disabled = true;
                btn.classList.add('offline-disabled');
            }
        });

        if (btnRuta) {
            btnRuta.onclick = () => {
                // El popup se cierra al toque; el feedback de "cargando" lo
                // muestra el propio servicio de ruteo en la tarjeta de navegación.
                marker.closePopup();
                iniciarNavegacionHacia(destinoLat, destinoLng, destinoNombre);
            };
        }
        if (btnUber) {
            btnUber.onclick = () => abrirUber(destinoLat, destinoLng, destinoNombre);
        }
        if (btnDidi) {
            btnDidi.onclick = () => abrirDiDi(destinoLat, destinoLng);
        }
    });
}
