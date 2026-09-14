/* ==========================================
   RUTA CORRENTINA - GESTOR DE UI v14.0
   ========================================== */
import { state } from '../core/store.js';
import { db } from '../config/firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from '../utils/helpers.js';
import { getProfileTemplate } from './templates.js';
import { cargarPerfil } from '../services/firebaseService.js';

// state.currentUser (Firebase Auth) sólo tiene displayName/email/uid; el nombre,
// avatar y lugares visitados que el usuario realmente edita viven en
// state.userProfile (Firestore, cargado por cargarPerfil). Se fusionan acá para
// que la plantilla siempre tenga los datos más recientes de ambas fuentes.
function renderProfileView() {
    const targetView = document.getElementById('view-profile');
    if (!targetView) return;
    targetView.innerHTML = getProfileTemplate({ ...state.currentUser, ...state.userProfile, favoritos: state.favoritos });

    // Estas tres funciones son exports de este módulo, no globales — un
    // onclick="..." inline en el HTML no las vería. Se conectan acá con
    // addEventListener en vez de eso.
    document.getElementById('btn-cancelar-editar-perfil')?.addEventListener('click', cerrarEditarPerfil);
    document.getElementById('btn-guardar-editar-perfil')?.addEventListener('click', guardarNuevoNombre);
    document.getElementById('avatar-input')?.addEventListener('change', (e) => procesarNuevoAvatar(e.target));
}

// toggleFavorite (src/utils/favoritosStore.js) avisa acá para que el
// contador "FAVORITOS" del perfil se actualice al toque si esa vista está
// abierta, sin que favoritosStore.js necesite conocer el DOM del perfil.
document.addEventListener('favoritos-actualizados', () => {
    if (document.getElementById('view-profile')?.classList.contains('active')) {
        renderProfileView();
    }
});

export function initTheme() {
    const isDark = localStorage.getItem('darkMode') === 'enabled';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
}

export function cambiarTab(tabName) {
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${tabName}`);
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    // Control y blindaje de contenido según la pestaña activa
    if (tabName === 'map' && state.map) {
        setTimeout(() => state.map.invalidateSize(), 300);
    } else if (tabName === 'profile') {
        renderProfileView();
        // Por si el perfil se editó en otra sesión/dispositivo, refrescamos desde
        // Firestore y volvemos a pintar con los datos más recientes.
        if (state.currentUser) {
            cargarPerfil(state.currentUser.uid).then(renderProfileView);
        }
    }
}

export function addMessage(text, sender, isLoading = false) {
    const body = document.getElementById('chat-body');
    if (!body) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender === 'user' ? 'chat-message-user' : 'chat-message-bot'}`;
    if (isLoading) msgDiv.id = 'loading-msg-' + Date.now();
    msgDiv.innerHTML = text;
    body.appendChild(msgDiv);
    body.scrollTop = body.scrollHeight;
    return msgDiv.id;
}

export function removeMessage(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
}

export function toggleChat() {
    const chat = document.getElementById('chat-widget');
    if (!chat) return;
    if (chat.classList.contains('chat-hidden')) {
        chat.classList.remove('chat-hidden');
        chat.classList.add('chat-visible');
        setTimeout(() => document.getElementById('user-msg').focus(), 300);
    } else {
        chat.classList.remove('chat-visible');
        chat.classList.add('chat-hidden');
    }
}

export function cerrarEditarPerfil() {
    const modalEl = document.getElementById('modal-edit-profile');
    if (modalEl) modalEl.classList.remove('active'); 
}

export async function guardarNuevoNombre() {
    const inputEl = document.getElementById('input-nuevo-nombre');
    const nuevoNombre = inputEl ? inputEl.value.trim() : '';
    if (nuevoNombre && nuevoNombre !== "" && state.currentUser) {
        await setDoc(doc(db, "users", state.currentUser.uid), { nombre: nuevoNombre }, { merge: true });
        await cargarPerfil(state.currentUser.uid);
        renderProfileView();
        showToast("✅ Perfil actualizado");
        return; // renderProfileView ya reconstruyó el modal cerrado, no hace falta cerrarEditarPerfil()
    }
    cerrarEditarPerfil();
}

export function procesarNuevoAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Image = e.target.result;
            // Actualización optimista: se ve el cambio al toque, sin esperar a Firestore.
            const avatarEl = document.getElementById('user-avatar');
            if (avatarEl) {
                avatarEl.style.backgroundImage = `url('${base64Image}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                avatarEl.style.color = 'transparent';
                avatarEl.textContent = '';
            }

            if (state.currentUser) {
                try {
                    showToast("⏳ Subiendo...");
                    await setDoc(doc(db, "users", state.currentUser.uid), { avatar: base64Image }, { merge: true });
                    await cargarPerfil(state.currentUser.uid);
                    showToast("✅ Avatar actualizado");
                } catch (error) {
                    showToast("❌ Error al guardar");
                }
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}