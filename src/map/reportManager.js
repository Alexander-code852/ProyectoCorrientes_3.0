/* ==========================================
   GESTOR DE REPORTES COMUNITARIOS - src/map/reportManager.js
   Conecta el botón "Reportar" (#btn-report-issue) de la botonera flotante
   del mapa: abre un modal para cargar un problema en la ubicación actual.

   OJO — cambio de arquitectura a propósito (pedido explícito): antes esto
   guardaba de verdad en la colección Firestore "reportes" (con addDoc) y
   los reportes ya guardados seguían apareciendo como pines en el mapa
   (eso sigue andando igual, ver firebaseService.js/reporteMarkers.js — no
   se tocó la LECTURA). Lo que cambió es el guardado: ahora handleSubmit()
   solo arma el payload y lo deja en consola, listo para que un backend
   Python lo reciba por POST — un reporte nuevo enviado desde este form NO
   se persiste en ningún lado hasta que conectes ese backend.
   ========================================== */
import { state } from '../core/store.js';
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
                        <option value="lugar_cerrado">Lugar cerrado</option>
                        <option value="ubicacion_incorrecta">Ubicación incorrecta</option>
                        <option value="problema_via">Problema en la vía</option>
                        <option value="otro">Otro</option>
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

        document.getElementById('form-reportar-incidente').addEventListener('submit', (ev) => {
            ev.preventDefault(); // Evita que la página se recargue

            const ubicacion = obtenerUbicacionActual();
            if (!ubicacion) {
                showToast("⚠️ No pudimos determinar tu ubicación");
                return;
            }

            const payload = {
                tipo: document.getElementById('reporte-tipo').value,
                descripcion: document.getElementById('reporte-descripcion').value,
                lat: ubicacion.lat,
                lng: ubicacion.lng,
                timestamp: new Date().toISOString(),
            };

            handleSubmit(payload);

            showToast("📝 Reporte listo (revisá la consola) — falta conectar el backend");
            modal.classList.remove('active');
            document.getElementById('form-reportar-incidente').reset();
        });
    }

    modal.classList.add('active');
}

// Punto de conexión con tu backend Python: por ahora solo deja constancia
// estructurada en consola. Para conectarlo de verdad, alcanza con
// reemplazar el console.log por un fetch POST (mismo patrón que ya usan
// src/services/asistenteLocalIA.js y src/services/recomendacionHoy.js
// para hablar con backend/ -detección de localhost para dev, ruta relativa
// para producción con reverse proxy). Ojo: al migrar a este stub se perdió
// el guardado real que tenía antes (Firestore "reportes") — un reporte
// enviado desde acá no se persiste en ningún lado hasta que este fetch
// exista de verdad.
function handleSubmit(payload) {
    console.log('[Reportar incidente] payload listo para backend Python:', payload);
}
