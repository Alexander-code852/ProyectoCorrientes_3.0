// src/core/store.js

export const state = {
    map: null,
    markersCluster: null,
    userMarker: null,
    routingControl: null,
    userCoords: null,
    currentPlace: null,
    currentUser: null,
    lugares: [],
    lugaresFiltrados: [],
    visitados: [],
    favoritos: [],
    reportes: [], 
    filtroActual: 'todos',
    busquedaActual: '',
    isNavigating: false,
    alertaParadaActiva: null,
    activeLayers: {
        turismo: true,
        museo: true,
        paseos: true,
        gastronomia: true,
        playa: true,
        hotel: true,
        salud: true,
        estacionamiento: true,
        parada: true,
        reportes: true
    }
};