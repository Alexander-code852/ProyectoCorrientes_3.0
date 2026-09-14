/* ==========================================
   SERVICIO DE BASE DE DATOS - src/services/firebaseService.js
   Tras el plan de modularización (pasos 1-4), este archivo ya no dibuja
   pines ni Firestore directo: solo orquesta repo (data/) -> pintado
   (map/markers/) -> vistas derivadas (Explorar/Juegos).
   ========================================== */
import { state } from '../core/store.js';
import { showToast, obtenerFechaHoyISO, formatearFechaEvento } from '../utils/helpers.js';
import { fetchLugares as fetchLugaresRepo } from '../data/lugaresRepo.js';
import { fetchEventos as fetchEventosRepo } from '../data/eventosRepo.js';
import { fetchReportes as fetchReportesRepo } from '../data/reportesRepo.js';
import { fetchPerfil } from '../data/perfilRepo.js';
import { pintarLugaresEnMapa, buscarMarkerLugar } from '../map/markers/lugarMarkers.js';
import { pintarEventosEnMapa, buscarMarkerEvento } from '../map/markers/eventoMarkers.js';
import { pintarReportesEnMapa } from '../map/markers/reporteMarkers.js';

// Trae los lugares (repo: Firestore + precargados) y los pinta en el mapa.
// Esta función es el punto de entrada público que ya usa el resto de la app
// (main.js, addPlaceManager.js) — el fetch en sí vive en data/lugaresRepo.js.
export async function fetchLugares() {
    const todosLosLugares = await fetchLugaresRepo();
    pintarLugaresEnMapa(todosLosLugares);
    return todosLosLugares;
}

// Aplica el filtro de actividad elegido en los "pills" del mapa (Todos, Playas,
// Cultura, Gastronomía, Naturaleza, Favoritos) y vuelve a pintar sólo lo que
// corresponde. "Abierto ahora" todavía no filtra de verdad: ningún lugar tiene
// horario cargado en los datos, así que por ahora se comporta como "Todos".
export function filtrarLugaresPorCategoria(categoria) {
    state.filtroActual = categoria;

    let filtrados = state.lugares;
    if (categoria === 'favoritos') {
        filtrados = state.lugares.filter(l => state.favoritos.includes(l.nombre));
    } else if (categoria !== 'todos' && categoria !== 'abierto') {
        filtrados = state.lugares.filter(l => l.categoria === categoria);
    }

    state.lugaresFiltrados = filtrados;
    pintarLugaresEnMapa(filtrados);
}

// Desde la vista Explorar (o cualquier otro lugar de la app): cambia a la vista
// Mapa, centra sobre el lugar buscado por nombre y abre su popup, que ya trae
// el botón "Cómo llegar" para calcular la ruta y elegir entre alternativas.
export function irALugarPorNombre(nombreLugar) {
    const lugar = state.lugares.find(l => l.nombre === nombreLugar);
    if (!lugar) {
        showToast("⚠️ No encontramos ese lugar en el mapa");
        return;
    }

    const lat = lugar.lat || lugar.latitude;
    const lng = lugar.lng || lugar.longitude;
    if (!lat || !lng) return;

    document.querySelector('.tab-btn[data-tab="map"]')?.click();

    const marker = buscarMarkerLugar(lat, lng);

    setTimeout(() => {
        if (!state.map) return;
        state.map.setView([lat, lng], 17);
        if (marker) marker.openPopup();
    }, 350);
}

// Trae los eventos (repo) y actualiza las 3 vistas que dependen de ellos:
// pines del mapa, "Eventos de la Semana" (Explorar) y "Juegos".
export async function cargarEventos() {
    const todosLosEventos = await fetchEventosRepo();
    pintarEventosEnMapa(todosLosEventos);
    renderEventosDeLaSemana(todosLosEventos);
    renderEventosDeHoyParaJuegos(todosLosEventos);
    return todosLosEventos;
}

// Sección "Juegos" (pensada para chicos de 1 a 15 años): muestra únicamente
// los eventos que la ciudad ofrece en el día de la fecha, tomando la misma
// lista combinada (precargados + Firestore) que ya usa el resto de la app.
function renderEventosDeHoyParaJuegos(listaEventos) {
    const contenedor = document.getElementById('juegos-eventos-hoy');
    if (!contenedor) return;

    const hoy = obtenerFechaHoyISO();
    const eventosDeHoy = (listaEventos || []).filter(evento => {
        if (!evento.fechaInicio) return false;
        const fin = evento.fechaFin || evento.fechaInicio;
        return evento.fechaInicio <= hoy && hoy <= fin;
    });

    if (eventosDeHoy.length === 0) {
        contenedor.innerHTML = '<p class="juegos-empty-msg">Hoy no hay eventos programados en la ciudad. ¡Volvé a revisar mañana! 🎨</p>';
        return;
    }

    contenedor.innerHTML = eventosDeHoy.map(evento => `
        <div class="juego-evento-card" data-evento-id="${evento.id}">
            <div class="juego-evento-emoji">🎉</div>
            <div class="juego-evento-info">
                <span class="juego-evento-hora">Hoy · ${evento.horario || ''}</span>
                <span class="juego-evento-titulo">${evento.nombre}</span>
                <span class="juego-evento-lugar">📍 ${evento.lugar || ''}</span>
            </div>
        </div>
    `).join('');

    contenedor.querySelectorAll('.juego-evento-card').forEach(card => {
        card.addEventListener('click', () => {
            const evento = eventosDeHoy.find(e => e.id === card.dataset.eventoId);
            if (evento) irAEvento(evento);
        });
    });
}

// Conecta la sección estática "Eventos de la Semana" de la vista Explorar (hasta
// ahora dos tarjetas fijas en el HTML) con los eventos reales, y hace que cada
// tarjeta lleve al mapa y abra el popup de ese evento.
function renderEventosDeLaSemana(listaEventos) {
    const contenedor = document.querySelector('.events-slider');
    if (!contenedor) return;

    if (!listaEventos || listaEventos.length === 0) {
        contenedor.innerHTML = '<p style="color: var(--text-sec, #8e8e93); font-size: 13px;">No hay eventos cargados por el momento.</p>';
        return;
    }

    const eventosOrdenados = [...listaEventos].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

    // evento.imagen todavía no existe como campo real en Firestore/eventos.js;
    // hasta que se cargue, cada tarjeta usa esta foto genérica de evento.
    const IMAGEN_EVENTO_PLACEHOLDER = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80';

    contenedor.innerHTML = eventosOrdenados.map(evento => `
        <div class="event-mini-card" data-evento-id="${evento.id}" style="background-image: url('${evento.imagen || IMAGEN_EVENTO_PLACEHOLDER}')">
            <span class="event-date">${formatearFechaEvento(evento.fechaInicio, evento.fechaFin)} · ${evento.horario || ''}</span>
            <span class="event-title">${evento.nombre}</span>
        </div>
    `).join('');

    contenedor.querySelectorAll('.event-mini-card').forEach(card => {
        card.addEventListener('click', () => {
            const evento = listaEventos.find(e => e.id === card.dataset.eventoId);
            if (evento) irAEvento(evento);
        });
    });
}

// Cambia a la vista Mapa, centra sobre el evento elegido y abre su popup.
function irAEvento(evento) {
    document.querySelector('.tab-btn[data-tab="map"]')?.click();

    const marker = buscarMarkerEvento(evento.lat, evento.lng);

    if (marker && state.map) {
        setTimeout(() => {
            state.map.setView([evento.lat, evento.lng], 16);
            marker.openPopup();
        }, 350);
    }
}

// Trae los reportes comunitarios (baches, alumbrado, inseguridad, etc.)
// cargados por vecinos vía el botón "Reportar" del mapa (ver
// src/map/reportManager.js) y los pinta como pines de alerta. Se vuelve a
// llamar después de guardar un reporte nuevo para que aparezca al instante.
export async function cargarReportesComunitarios() {
    const reportes = await fetchReportesRepo();
    pintarReportesEnMapa(reportes);
}

// Sin lógica propia: cargarPerfil ya no hace nada más que el fetch, así que
// es un simple alias del repo (se mantiene el nombre para no tocar los
// imports existentes en uiManager.js).
export const cargarPerfil = fetchPerfil;
