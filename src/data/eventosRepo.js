/* ==========================================
   REPOSITORIO DE EVENTOS (Firestore) - src/data/eventosRepo.js
   Extraído de firebaseService.js (Paso 3 del plan de modularización):
   solo acceso a datos, sin pintado de pines ni de las secciones
   "Eventos de la Semana" / "Juegos" (eso lo sigue orquestando
   firebaseService.js).
   ========================================== */
import { db } from '../config/firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from '../core/store.js';
import { EVENTOS_PRECARGADOS } from '../core/eventos.js';

// Trae los eventos de Firestore, los combina con los precargados
// (EVENTOS_PRECARGADOS) y los deja cacheados en state.eventos.
export async function fetchEventos() {
    try {
        const eventosRef = collection(db, "eventos");
        const querySnapshot = await getDocs(eventosRef);
        const eventosFirebase = [];

        querySnapshot.forEach((docSnap) => {
            eventosFirebase.push({ id: docSnap.id, ...docSnap.data() });
        });

        const todosLosEventos = [...EVENTOS_PRECARGADOS, ...eventosFirebase];
        state.eventos = todosLosEventos;
        return todosLosEventos;

    } catch (error) {
        console.error("Error al obtener los eventos de Firebase:", error);
        state.eventos = EVENTOS_PRECARGADOS;
        return EVENTOS_PRECARGADOS;
    }
}
