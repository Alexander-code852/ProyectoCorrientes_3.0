/* ==========================================
   GESTOR DE REPORTES COMUNITARIOS - src/map/reportManager.js
   Conecta el botón "Reportar" (#btn-report-issue) de la botonera flotante
   del mapa: abre un modal para cargar un problema (bache, alumbrado,
   inseguridad, etc.) en la ubicación actual y lo guarda en la colección
   Firestore "reportes" — la misma que carga y pinta como pines
   src/services/firebaseService.js (cargarReportesComunitarios) al iniciar
   la app. Mismo patrón que src/map/addPlaceManager.js.
   ========================================== */
import { state } from '../core/store.js';
import { db } from '../config/firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { cargarReportesComunitarios } from '../services/firebaseService.js';
import { showToast } from '../utils/helpers.js';

export function initReportButton() {
    const btnReportar = document.getElementById('btn-report-issue');
    if (!btnReportar) return;

    btnReportar.addEventListener('click', () => {
        abrirModalReporte();
    });
}

// Preferimos la última posición GPS conocida (mapManager.js la actualiza
// en tiempo real); si todavía no hay GPS disponible, usamos el centro
// visible del mapa como ubicación del reporte.
function obtenerUbicacionActual() {
    if (state.userCoords) {
        return { lat: state.userCoords.lat, lng: state.userCoords.lng };
    }
    if (state.map) {
        const centro = state.map.getCenter();
        return { lat: centro.lat, lng: centro.lng };
    }
    return null;
}

function abrirModalReporte() {
    let modal = document.getElementById('modal-reportar-incidente');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-reportar-incidente';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-card">
                <h3>⚠️ Reportar un problema</h3>
                <p>Se guarda en tu ubicación actual para que otros vecinos lo vean en el mapa.</p>
                <form id="form-reportar-incidente">
                    <select id="reporte-tipo">
                        <option value="Bache">Bache / calle en mal estado</option>
                        <option value="Alumbrado">Alumbrado público</option>
                        <option value="Inseguridad">Inseguridad</option>
                        <option value="Basura">Basura acumulada</option>
                        <option value="Otro">Otro</option>
                    </select>
                    <textarea id="reporte-descripcion" placeholder="Contanos brevemente qué pasa..." required></textarea>
                    <div class="modal-actions">
                        <button type="button" id="btn-cancelar-reporte" class="ios-btn-secondary">Cancelar</button>
                        <button type="submit" class="ios-btn-primary">Enviar reporte</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancelar-reporte').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        document.getElementById('form-reportar-incidente').addEventListener('submit', async (ev) => {
            ev.preventDefault(); // Evita que la página se recargue

            const ubicacion = obtenerUbicacionActual();
            if (!ubicacion) {
                showToast("⚠️ No pudimos determinar tu ubicación");
                return;
            }

            const tipo = document.getElementById('reporte-tipo').value;
            const descripcion = document.getElementById('reporte-descripcion').value;

            try {
                // Guardar en la colección 'reportes' de Firebase Firestore
                await addDoc(collection(db, "reportes"), {
                    tipo,
                    descripcion,
                    lat: ubicacion.lat,
                    lng: ubicacion.lng,
                    createdAt: new Date()
                });

                showToast("✅ ¡Gracias! Tu reporte fue enviado");
                modal.classList.remove('active');
                document.getElementById('form-reportar-incidente').reset();

                // Recargar los reportes para que el pin aparezca al instante
                await cargarReportesComunitarios();
            } catch (error) {
                console.error("Error al guardar el reporte en Firebase:", error);
                showToast("⚠️ Hubo un error al enviar el reporte");
            }
        });
    }

    modal.classList.add('active');
}
