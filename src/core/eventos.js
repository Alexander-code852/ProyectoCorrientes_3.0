/* ==========================================
   EVENTOS DE CORRIENTES CAPITAL - src/core/eventos.js
   ========================================== */

// Relevados manualmente desde los portales oficiales de turismo y cultura de
// Corrientes (corrientes.tur.ar, culturacorrientes.com, ciudaddecorrientes.gov.ar).
// No se pueden scrapear en vivo desde el navegador: esos sitios no habilitan CORS
// (Access-Control-Allow-Origin), así que un fetch directo desde el cliente falla.
// Este listado funciona como respaldo, igual que LUGARES_PRECARGADOS en
// firebaseService.js, y se combina con la colección "eventos" de Firestore por si
// se cargan eventos nuevos a mano o, a futuro, con una Cloud Function que sí puede
// scrapear del lado del servidor (sin restricción de CORS) y escribirlos ahí.
//
// Coordenadas geocodificadas con la dirección real de cada sede (OpenStreetMap
// Nominatim), no estimadas a ojo, para que el pin caiga sobre el edificio exacto.
export const EVENTOS_PRECARGADOS = [
    {
        id: 'evento-1',
        nombre: 'Latinoamérica Fashion Week',
        categoria: 'evento',
        fechaInicio: '2026-09-08',
        fechaFin: '2026-09-12',
        horario: '20:00 hs',
        lugar: 'Espacio Guajó, Costanera Sur y Lamadrid',
        descripcion: 'Desfiles y marcas de moda de toda Latinoamérica sobre la Costanera Sur.',
        lat: -27.4774,
        lng: -58.8560,
        fuente: 'https://corrientes.tur.ar/agenda/'
    },
    {
        id: 'evento-2',
        nombre: '2° Feria de Cafeterías de Especialidad & Origami Cup',
        categoria: 'evento',
        fechaInicio: '2026-09-12',
        fechaFin: '2026-09-12',
        horario: '09:00 a 20:00 hs',
        lugar: 'Turismo Hotel Casino, Entre Ríos 650',
        descripcion: 'Feria de café de especialidad con degustaciones y la competencia Origami Cup.',
        lat: -27.4642,
        lng: -58.8442,
        fuente: 'https://corrientes.tur.ar/agenda/'
    },
    {
        id: 'evento-3',
        nombre: 'Connie Ballarini - Tour 2026',
        categoria: 'evento',
        fechaInicio: '2026-10-04',
        fechaFin: '2026-10-04',
        horario: '21:00 hs',
        lugar: 'Teatro Oficial Juan de Vera, San Juan 637',
        descripcion: 'Show de stand up en el Teatro Vera.',
        lat: -27.4648,
        lng: -58.8361,
        fuente: 'https://corrientes.tur.ar/agenda/'
    },
    {
        id: 'evento-4',
        nombre: 'TOPOFILIA - Muestra de Arte',
        categoria: 'evento',
        fechaInicio: '2026-10-09',
        fechaFin: '2026-10-09',
        horario: '20:00 hs',
        lugar: 'Sala José Negro, Museo de Bellas Artes Dr. Juan R. Vidal',
        descripcion: 'Inauguración de muestra de artes visuales en el Museo de Bellas Artes.',
        lat: -27.4646,
        lng: -58.8367,
        fuente: 'https://culturacorrientes.com/agenda-cultural-2/'
    },
    {
        id: 'evento-5',
        nombre: 'Arcilla Viva - Muestra de Escultura',
        categoria: 'evento',
        fechaInicio: '2026-10-10',
        fechaFin: '2026-10-10',
        horario: '20:00 hs',
        lugar: 'Sala José Negro, Museo de Bellas Artes Dr. Juan R. Vidal',
        descripcion: 'Exposición de esculturas en la sala verde del Museo de Bellas Artes.',
        lat: -27.4646,
        lng: -58.8367,
        fuente: 'https://culturacorrientes.com/agenda-cultural-2/'
    },
    {
        id: 'evento-6',
        nombre: 'Besos en la Frente - Cine en el Bellas Artes',
        categoria: 'evento',
        fechaInicio: '2026-10-11',
        fechaFin: '2026-10-11',
        horario: '20:00 hs',
        lugar: 'Museo de Bellas Artes Dr. Juan R. Vidal',
        descripcion: 'Proyección de cine con entrada libre y gratuita.',
        lat: -27.4646,
        lng: -58.8367,
        fuente: 'https://culturacorrientes.com/agenda-cultural-2/'
    },
    {
        id: 'evento-7',
        nombre: 'Feria de Artesanos',
        categoria: 'evento',
        fechaInicio: '2026-09-11',
        fechaFin: '2026-09-11',
        horario: '19:00 hs',
        lugar: 'Plaza Cabral',
        descripcion: 'Feria semanal de artesanos en el centro de la ciudad.',
        lat: -27.4687,
        lng: -58.8312,
        fuente: 'https://ciudaddecorrientes.gov.ar/eventos/agenda'
    },
    {
        id: 'evento-8',
        nombre: 'Peña Folclórica Abierta',
        categoria: 'evento',
        fechaInicio: '2026-09-12',
        fechaFin: '2026-09-12',
        horario: '16:00 hs',
        lugar: 'Anfiteatro Mario del Tránsito Cocomarola',
        descripcion: 'Peña folclórica al aire libre abierta a la comunidad.',
        lat: -27.4906,
        lng: -58.8302,
        fuente: 'https://ciudaddecorrientes.gov.ar/eventos/agenda'
    }
];
