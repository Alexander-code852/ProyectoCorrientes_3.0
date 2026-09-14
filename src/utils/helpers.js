// src/utils/helpers.js

export function getDistance(lat1, lon1, lat2, lon2) { 
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180; 
    const dLon = (lon2 - lon1) * Math.PI / 180; 
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2; 
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
}

export function showToast(mensaje) {
    // Buscamos el contenedor
    let container = document.getElementById('toast-container');
    
    // Si no existe (porque lo borramos del HTML), lo creamos sobre la marcha
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container'; // Asegúrate de tener esto en tu CSS
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerText = mensaje;

    container.appendChild(toast);

    // Animación de entrada y salida
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Devuelve la fecha de hoy como "YYYY-MM-DD" en horario local (no UTC), para
// poder compararla directamente con fechaInicio/fechaFin de los eventos.
export function obtenerFechaHoyISO() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Sanitiza texto libre antes de insertarlo en innerHTML. Hace falta en
// cualquier lado que renderice un campo que un usuario puede escribir a mano
// (descripción de un reporte, nombre/descripción de un lugar agregado por
// el botón "+", nombre de perfil) — sin esto, alguien podía escribir
// "<img src=x onerror=alert(1)>" como descripción de un reporte y ese script
// se ejecutaba para cualquiera que abriera el popup de ese pin (XSS
// persistente real, no teórico: reportManager.js y addPlaceManager.js
// guardan esos campos tal cual en Firestore, sin ninguna sanitización).
export function escapeHTML(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Convierte "2026-09-08"/"2026-09-12" en algo legible como "Mar 8 al Sáb 12 de Sep."
// o, si es un solo día, "Vie 12 de Septiembre".
export function formatearFechaEvento(fechaInicio, fechaFin) {
    const opciones = { weekday: 'short', day: 'numeric', month: 'long' };
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const textoInicio = inicio.toLocaleDateString('es-AR', opciones);

    if (!fechaFin || fechaFin === fechaInicio) {
        return capitalizar(textoInicio);
    }

    const fin = new Date(fechaFin + 'T00:00:00');
    const textoFin = fin.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' });
    return `${capitalizar(textoInicio)} al ${capitalizar(textoFin)}`;
}

export function setupHeaderDate() {
    const d = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'short' };
    const dateStr = d.toLocaleDateString('es-ES', options);
    const hour = d.getHours();
    
    let saludo = "Hola, Viajero";
    if(hour >= 6 && hour < 12) saludo = "Buenos días";
    else if(hour >= 12 && hour < 20) saludo = "Buenas tardes";
    else saludo = "Buenas noches";

    const dateEl = document.getElementById('date-display');
    const greetEl = document.getElementById('greeting-display');
    
    if(dateEl) dateEl.innerText = dateStr;
    if(greetEl) {
        const mateSvg = `<svg class="mate-svg-icon" viewBox="0 0 32 32" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 4L13 13.5" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round"/><path d="M19 3L22 6" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round"/><path d="M8 11H24C24 11 25.5 13 24 15H8C6.5 13 8 11 8 11Z" fill="#007AFF" opacity="0.25" stroke="#007AFF" stroke-width="2"/><path d="M9 14C9 14 6 22 16 26C26 22 23 14 23 14H9Z" fill="#007AFF" stroke="#007AFF" stroke-width="2" stroke-linejoin="round"/><path d="M12 22H20C20 24 19 26 16 26C13 26 12 24 12 22Z" fill="#007AFF"/></svg>`;
        greetEl.innerHTML = `${saludo} <span class="mate-badge" title="¡Un buen mate correntino!">${mateSvg}</span>`;
    }
}