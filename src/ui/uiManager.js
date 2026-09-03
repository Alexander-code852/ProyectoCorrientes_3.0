// src/ui/uiManager.js

import { state } from '../core/store.js';
import { PREMIOS } from '../core/constants.js';
import { getDistance, showToast } from '../utils/helpers.js';
import { renderMarkers } from '../map/mapManager.js';
import { feedCardTemplate, fichaLugarTemplate, couponTemplate } from './templates.js';

export function initTheme() { 
    if(localStorage.getItem('theme')==='dark') document.body.classList.add('dark-mode'); 
    document.getElementById('dark-mode-toggle').onclick = () => { 
        document.body.classList.toggle('dark-mode'); 
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
        window.updateMapTiles(); 
    };
}

export function cambiarTab(id) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active')); 
    document.getElementById(`view-${id}`).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-btn')[{ 'map':0, 'list':1, 'profile':2 }[id]].classList.add('active');
    if(id==='map' && state.map) setTimeout(()=>state.map.invalidateSize(), 500);
}

export function renderFeedSkeletons() {
    const c = document.getElementById('feed-container');
    if(c) c.innerHTML = Array(4).fill('<div class="skeleton" style="height:180px; border-radius:28px;"></div>').join('');
}

export function renderFeed(list) { 
    const c = document.getElementById('feed-container'); 
    if(!c) return;
    if(!list || list.length === 0) { 
        c.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:20px; color:#888">No hay lugares para mostrar.</div>'; 
        return; 
    } 
    
    let renderList = [...list];
    if(state.userCoords) {
        renderList.sort((a, b) => getDistance(state.userCoords.lat, state.userCoords.lng, a.lat, a.lng) - getDistance(state.userCoords.lat, state.userCoords.lng, b.lat, b.lng));
    }
    
    c.innerHTML = renderList.map((lugar, index) => { 
        const isFav = state.favoritos.includes(lugar.nombre); 
        let catIcon = 'location-outline'; 
        let colorClass = lugar.categoria.split(' ')[0];
        
        if(lugar.categoria.includes('turismo') || lugar.categoria.includes('museo')) catIcon = 'camera';
        if(lugar.categoria.includes('gastronomia') || lugar.categoria.includes('comida')) catIcon = 'restaurant';
        if(lugar.categoria.includes('playa')) catIcon = 'umbrella';
        if(lugar.categoria.includes('estacionamiento')) { catIcon = 'car'; colorClass = 'gray'; }
        if(lugar.categoria.includes('parada')) { catIcon = 'bus'; colorClass = 'bus'; }
        if(lugar.categoria.includes('reportes')) { catIcon = 'warning'; colorClass = 'report'; }

        const imgUrl = lugar.img || 'https://placehold.co/400x300?text=Ruta+Correntina';
        const cardClass = index === 0 ? 'card-modern card-hero' : 'card-modern';
        let distanciaTxt = '';
        
        if(state.userCoords) {
            const meters = getDistance(state.userCoords.lat, state.userCoords.lng, lugar.lat, lugar.lng);
            const km = meters < 1000 ? `${Math.round(meters)} m` : `${(meters/1000).toFixed(1)} km`;
            distanciaTxt = `<span class="card-dist-badge"><ion-icon name="navigate"></ion-icon> ${km}</span>`;
        }

        return feedCardTemplate(lugar, isFav, catIcon, colorClass, imgUrl, cardClass, distanciaTxt);
    }).join(''); 
}

export function abrirFicha(l) {
    state.currentPlace = l;
    const isFav = state.favoritos.includes(l.nombre);
    const bgStyle = l.img ? `<img src="${l.img}" loading="lazy" onerror="this.parentElement.style.height='70px'; this.style.display='none';">` : ``;
    const heroHeightStyle = l.img ? `` : `height: 70px; background: transparent;`;

    let menuHTML = '';
    if(l.menu && l.menu.length > 0) {
        menuHTML = `<div class="restaurant-menu"><h3>Menú Destacado</h3>${l.menu.map(m => `<div class="menu-item-row"><span>${m.item}</span><strong>$${m.precio.toLocaleString('es-AR')}</strong></div>`).join('')}</div>`;
    }

    let parkingDispoHTML = '';
    if(l.categoria.includes('estacionamiento')) {
        const max = l.capacidadMax || 50; 
        const libres = max - Math.floor(Math.random() * max);
        const colorDispo = libres > 15 ? 'var(--success)' : (libres > 5 ? '#FF9500' : 'var(--danger)');
        parkingDispoHTML = `<div style="background: rgba(0,0,0,0.03); padding: 15px; border-radius: 16px; margin-top: 15px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(0,0,0,0.05);"><div style="display:flex; align-items:center; gap: 15px;"><div style="width:45px; height:45px; border-radius:12px; background:${colorDispo}; color:white; display:flex; align-items:center; justify-content:center; font-size:1.3rem; box-shadow: 0 4px 10px ${colorDispo}40;"><ion-icon name="car"></ion-icon></div><div style="display:flex; flex-direction:column;"><span style="font-weight:800; font-size:1.1rem; color:var(--text-main);">${libres} Libres</span><small style="color:var(--text-sec); font-weight: 500;">de ${max} espacios totales</small></div></div><div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;"><span style="font-size:0.75rem; font-weight:800; color:${colorDispo}; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:8px;">EN VIVO</span></div></div>`;
    }

    let lineasHTML = '';
    if(l.lineas && l.lineas.length > 0) {
        lineasHTML = `<div style="margin-top: 15px; background: rgba(88,86,214,0.05); padding: 15px; border-radius: 16px; border: 1px solid rgba(88,86,214,0.1);"><h3 style="font-size: 0.85rem; color: #5856D6; text-transform: uppercase; margin: 0 0 10px 0; font-weight: 800;"><ion-icon name="git-branch"></ion-icon> Líneas que pasan por aquí</h3><div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">${l.lineas.map(linea => `<span onclick="filtrarPorLinea('${linea}')" style="background: linear-gradient(135deg, #5856D6, #AF52DE); color: white; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor:pointer; box-shadow: 0 2px 8px rgba(88,86,214,0.3);">Línea ${linea}</span>`).join('')}</div><button onclick="activarAlertaParada('${l.nombre.replace(/'/g, "")}', ${l.lat}, ${l.lng})" class="btn-action secondary" style="width: 100%; background: rgba(88,86,214,0.1); color: #5856D6; font-size: 0.9rem; padding: 10px;"><ion-icon name="notifications"></ion-icon> Avisarme al llegar a esta parada</button></div>`;
    }

    let audioGuiaHTML = '';
    if(l.desc && (l.categoria.includes('turismo') || l.categoria.includes('museo') || l.categoria.includes('paseos'))) {
        audioGuiaHTML = `<button onclick="reproducirAudioGuia('${l.nombre.replace(/'/g, "")}', '${l.desc.replace(/'/g, "")}')" class="btn-action secondary" style="margin-top: 12px; background: rgba(0,122,255,0.1); color: var(--primary);"><ion-icon name="volume-high"></ion-icon> Escuchar Audio-Guía</button>`;
    }

    document.getElementById('ficha-lugar').innerHTML = fichaLugarTemplate(l, isFav, bgStyle, heroHeightStyle, parkingDispoHTML, lineasHTML, audioGuiaHTML, menuHTML);
    
    document.getElementById('ficha-lugar').classList.add('open');
    window.actualizarBotonCheckin();
    window.cargarComentarios(l.nombre);
}

export function cerrarFicha() { 
    document.getElementById('ficha-lugar').classList.remove('open'); 
    state.currentPlace = null; 
}

export function renderCoupons(puntosUser) {
    document.getElementById('canje-list').innerHTML = PREMIOS.map(p => {
        const puede = puntosUser >= p.costo;
        return couponTemplate(puntosUser, p, puede);
    }).join('');
}

export function toggleAuthUI(isLoggedIn) {
    const authContainer = document.getElementById('auth-container'); 
    const profileContent = document.getElementById('user-profile-content');
    const bottomTabBar = document.querySelector('.bottom-tab-bar');
    const chatFloatBtn = document.querySelector('.btn-chat-float');

    if(isLoggedIn) { 
        if(authContainer) authContainer.style.display = 'none'; 
        if(profileContent) profileContent.style.display = 'block'; 
        if(bottomTabBar) bottomTabBar.style.display = 'flex';
        if(chatFloatBtn) chatFloatBtn.style.display = 'flex';
    } else { 
        if(authContainer) authContainer.style.display = 'flex'; 
        if(profileContent) profileContent.style.display = 'none'; 
        if(bottomTabBar) bottomTabBar.style.display = 'none';
        if(chatFloatBtn) chatFloatBtn.style.display = 'none';
    }
}

export function addMessage(text, sender, isLoading = false) {
    const chatBody = document.getElementById('chat-messages'); 
    const div = document.createElement('div'); 
    div.className = sender === 'user' ? 'user-msg' : 'bot-msg';
    
    if (isLoading) { 
        div.id = 'loading-msg'; 
        div.innerHTML = '<ion-icon name="sync" class="spin-anim"></ion-icon> Pensando...'; 
    } else { 
        div.innerHTML = (sender === 'bot') ? text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') : text; 
    }
    
    chatBody.appendChild(div); 
    chatBody.scrollTop = chatBody.scrollHeight; 
    return div.id;
}

export function removeMessage(id) { 
    const el = document.getElementById(id); 
    if (el) el.remove(); 
}