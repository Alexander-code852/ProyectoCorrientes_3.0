// src/core/constants.js

export const CONFIG = {
    radioCheckin: 400, 
    gpsOptions: { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    defaultCenter: [-27.469, -58.830]
};

export const PREMIOS = [
    { id: 1, nombre: "Descuento en Heladería", costo: 100 },
    { id: 2, nombre: "Paseo en Lancha Gratis", costo: 300 },
    { id: 3, nombre: "Cena VIP para 2", costo: 500 }
];