// src/core/store.js

export const state = {
    map: null,
    userCoords: null,
    currentUser: null,
    lugares: [],
    lugaresFiltrados: [],
    eventos: [],
    visitados: [],
    favoritos: [],
    reportes: [],
    filtroActual: 'todos',
    // Capa de estacionamiento del panel de capas (ver src/ui/events.js +
    // src/map/markers/estacionamientoMarkers.js). Antes este objeto traía
    // 9 campos más (turismo/museo/paseos/gastronomia/playa/hotel/salud/
    // parada/reportes) que nunca llegó a leer ni escribir ningún módulo —
    // el filtrado real de lugares lo hace filtroActual/lugaresFiltrados
    // de arriba, no esto.
    activeLayers: {
        estacionamiento: false // los checkboxes del panel arrancan destildados
    }
};