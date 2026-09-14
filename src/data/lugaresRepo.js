/* ==========================================
   REPOSITORIO DE LUGARES (Firestore) - src/data/lugaresRepo.js
   Extraído de firebaseService.js (Paso 3 del plan de modularización):
   solo acceso a datos (fetch + caché en el store), sin nada de Leaflet ni
   DOM. El pintado de pines lo sigue orquestando firebaseService.js.
   ========================================== */
import { db } from '../config/firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from '../core/store.js';

// Lugares pre-cargados por defecto en Corrientes
const LUGARES_PRECARGADOS = [
    {
        id: 'precargado-1',
        nombre: 'Puente General Belgrano',
        categoria: 'cultura',
        descripcion: 'Emblemático puente interprovincial que conecta Corrientes con el Chaco.',
        lat: -27.4705,
        lng: -58.8471
    },
    {
        id: 'precargado-2',
        nombre: 'Costanera General San Martín',
        categoria: 'playas',
        descripcion: 'Hermoso paseo costero con vistas al Río Paraná y puntos ideales para matear.',
        lat: -27.4585,
        lng: -58.8681
    },
    {
        id: 'precargado-3',
        nombre: 'Centenario Shopping',
        categoria: 'gastronomia',
        descripcion: 'Centro comercial con locales, tiendas, cines y patio de comidas.',
        lat: -27.4832,
        lng: -58.8120
    },
    {
        id: 'precargado-4',
        nombre: 'Antigua Unidad Penal (Ex Cárcel)',
        categoria: 'cultura',
        descripcion: 'Histórico edificio frente al río en pleno proceso de transformación urbana.',
        lat: -27.4621,
        lng: -58.8550
    }
];

// Trae los lugares de Firestore, los combina con los precargados y los deja
// cacheados en state.lugares. No pinta nada en el mapa — eso lo hace quien
// llama a esta función (ver fetchLugares en firebaseService.js).
export async function fetchLugares() {
    try {
        const lugaresRef = collection(db, "lugares");
        const querySnapshot = await getDocs(lugaresRef);
        const lugaresFirebase = [];

        querySnapshot.forEach((docSnap) => {
            lugaresFirebase.push({ id: docSnap.id, ...docSnap.data() });
        });

        const todosLosLugares = [...LUGARES_PRECARGADOS, ...lugaresFirebase];
        state.lugares = todosLosLugares;
        return todosLosLugares;

    } catch (error) {
        console.error("Error al obtener los lugares de Firebase:", error);
        state.lugares = LUGARES_PRECARGADOS;
        return LUGARES_PRECARGADOS;
    }
}
