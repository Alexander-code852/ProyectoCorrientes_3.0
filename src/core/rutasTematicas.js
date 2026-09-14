/* ==========================================
   RUTAS TEMÁTICAS DE LA COMUNIDAD - src/core/rutasTematicas.js
   Contenido de ejemplo: no existe todavía un backend de rutas creadas por
   usuarios (ver database/schema.sql para el diseño de esa parte — tablas
   rutas/ruta_lugares/rutas_guardadas). Cada entrada de "lugares" lleva
   nombre + miniatura: el nombre debe matchear exactamente lugar.nombre de
   data/lugaresRepo.js/Firestore, porque rutasTematicasUI.js resuelve
   lat/lng buscando por ese nombre en state.lugares (los lugares
   precargados no tienen campo "imagen" propio todavía, por eso la
   miniatura de portada vive acá en vez de tomarse del lugar).
   ========================================== */

export const RUTAS_PRECARGADAS = [
    {
        id: 'ruta-1',
        titulo: 'Circuito Histórico y Costero',
        creador: 'CorrientesNativa',
        avatarCreador: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=100&q=80',
        lugares: [
            { nombre: 'Puente General Belgrano', imagen: 'https://images.unsplash.com/photo-1509644851169-2acc08aa25b5?auto=format&fit=crop&w=200&q=80' },
            { nombre: 'Antigua Unidad Penal (Ex Cárcel)', imagen: 'https://images.unsplash.com/photo-1524230659092-07f99a75c013?auto=format&fit=crop&w=200&q=80' },
            { nombre: 'Costanera General San Martín', imagen: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=200&q=80' },
        ],
    },
    {
        id: 'ruta-2',
        titulo: 'Tarde de Shopping y Río',
        creador: 'FoodieMatias',
        avatarCreador: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
        lugares: [
            { nombre: 'Centenario Shopping', imagen: 'https://images.unsplash.com/photo-1555529771-7888783a18d3?auto=format&fit=crop&w=200&q=80' },
            { nombre: 'Costanera General San Martín', imagen: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=200&q=80' },
        ],
    },
];
