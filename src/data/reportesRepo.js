/* ==========================================
   REPOSITORIO DE REPORTES COMUNITARIOS (Firestore) - src/data/reportesRepo.js
   Extraído de firebaseService.js (Paso 3 del plan de modularización):
   solo acceso a datos. El pintado de pines lo sigue orquestando
   firebaseService.js.
   ========================================== */
import { db } from '../config/firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from '../core/store.js';

// Trae los reportes comunitarios (baches, alumbrado, inseguridad, etc.)
// cargados por vecinos vía el botón "Reportar" del mapa (ver
// src/map/reportManager.js) y los deja cacheados en state.reportes.
export async function fetchReportes() {
    try {
        const reportesRef = collection(db, "reportes");
        const querySnapshot = await getDocs(reportesRef);
        const reportes = [];
        querySnapshot.forEach((docSnap) => {
            reportes.push({ id: docSnap.id, ...docSnap.data() });
        });
        state.reportes = reportes;
        return reportes;
    } catch (error) {
        console.error("Error al obtener los reportes comunitarios:", error);
        state.reportes = [];
        return [];
    }
}
