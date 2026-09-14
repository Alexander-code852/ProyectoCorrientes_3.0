/* ==========================================
   REPOSITORIO DE PERFIL DE USUARIO (Firestore) - src/data/perfilRepo.js
   Extraído de firebaseService.js (Paso 3 del plan de modularización).
   ========================================== */
import { db } from '../config/firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from '../core/store.js';

export async function fetchPerfil(uid) {
    if (!uid) return;
    try {
        const userRef = doc(db, "users", uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            state.userProfile = docSnap.data();
        } else {
            state.userProfile = { visitados: [] };
        }
    } catch (error) {
        console.error("Error al cargar el perfil:", error);
    }
}
