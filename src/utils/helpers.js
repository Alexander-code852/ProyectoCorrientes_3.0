// src/utils/helpers.js

export function getDistance(lat1, lon1, lat2, lon2) { 
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180; 
    const dLon = (lon2 - lon1) * Math.PI / 180; 
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2; 
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
}

export function showToast(m) { 
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.innerText = m; 
    document.getElementById('toast-container').appendChild(t); 
    setTimeout(() => t.remove(), 3000); 
}

export function flattenLugares(data) {
    let out = [];
    if (Array.isArray(data)) {
        data.forEach(grupo => {
            Object.keys(grupo).forEach(categoria => {
                if(Array.isArray(grupo[categoria])) {
                    grupo[categoria].forEach(lugar => {
                        out.push({
                            ...lugar, categoria: categoria,
                            lat: lugar.lat_lng ? lugar.lat_lng[0] : null,
                            lng: lugar.lat_lng ? lugar.lat_lng[1] : null
                        });
                    });
                }
            });
        });
    }
    return out.filter(l => l.lat && l.lng);
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