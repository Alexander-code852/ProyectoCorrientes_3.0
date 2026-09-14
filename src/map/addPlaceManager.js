/* ==========================================
   GESTOR PARA AGREGAR LUGARES AL MAPA
   ========================================== */
import { state } from '../core/store.js';
import { db } from '../config/firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { fetchLugares } from '../services/firebaseService.js';
import { showToast } from '../utils/helpers.js';

let tempMarker = null;

export function initAddPlaceOnClick() {
    const mapaActivo = state.map;
    if (!mapaActivo) return;

    mapaActivo.on('click', (e) => {
        const { lat, lng } = e.latlng;

        if (tempMarker) {
            mapaActivo.removeLayer(tempMarker);
        }

        tempMarker = L.marker([lat, lng], { draggable: true }).addTo(mapaActivo);
        abrirModalNuevoLugar(lat, lng);
    });
}

function abrirModalNuevoLugar(lat, lng) {
    let modal = document.getElementById('modal-agregar-lugar');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-agregar-lugar';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-card">
                <h3>📍 Agregar Nuevo Lugar</h3>
                <p>Completa los datos del punto seleccionado en el mapa.</p>
                <form id="form-nuevo-lugar">
                    <input type="text" id="nuevo-nombre" placeholder="Nombre del lugar" required>
                    <select id="nuevo-categoria">
                        <option value="playas">Playa</option>
                        <option value="gastronomia">Gastronomía</option>
                        <option value="cultura">Cultura</option>
                        <option value="naturaleza">Naturaleza</option>
                    </select>
                    <textarea id="nuevo-descripcion" placeholder="Breve descripción..."></textarea>
                    <div class="modal-actions">
                        <button type="button" id="btn-cancelar-lugar" class="ios-btn-secondary">Cancelar</button>
                        <button type="submit" class="ios-btn-primary">Guardar Lugar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-cancelar-lugar').addEventListener('click', () => {
            modal.classList.remove('active');
            if (tempMarker) state.map.removeLayer(tempMarker);
        });

        document.getElementById('form-nuevo-lugar').addEventListener('submit', async (ev) => {
            ev.preventDefault(); // Evita que la página se recargue
            
            const nombre = document.getElementById('nuevo-nombre').value;
            const categoria = document.getElementById('nuevo-categoria').value;
            const descripcion = document.getElementById('nuevo-descripcion').value;

            try {
                // Guardar en la colección 'lugares' de Firebase Firestore
                await addDoc(collection(db, "lugares"), {
                    nombre,
                    categoria,
                    descripcion,
                    lat,
                    lng,
                    createdAt: new Date()
                });

                showToast("✅ ¡Lugar guardado con éxito!");
                modal.classList.remove('active');
                if (tempMarker) state.map.removeLayer(tempMarker);

                // Recargar los lugares para que el pin aparezca al instante
                await fetchLugares();
            } catch (error) {
                console.error("Error al guardar el lugar en Firebase:", error);
                showToast("⚠️ Hubo un error al guardar el lugar");
            }
        });
    }

    modal.classList.add('active');
}