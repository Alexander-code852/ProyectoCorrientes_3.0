// src/map/mapManager.js

import { CONFIG } from '../core/constants.js';
import { state } from '../core/store.js';
import { showToast, getDistance } from '../utils/helpers.js';

export function initMap() {
    state.map = L.map('map', { zoomControl: false, attributionControl: false }).setView(CONFIG.defaultCenter, 14);
    updateMapTiles();
    
    state.map.on('load', () => {
        const loader = document.getElementById('map-loader');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 300);
        }
    });
    
    state.markersCluster = L.markerClusterGroup({ 
        showCoverageOnHover: false, maxClusterRadius: 40,
        iconCreateFunction: function(cluster) {
            return L.divIcon({ html: `<div>${cluster.getChildCount()}</div>`, className: 'custom-cluster', iconSize: [40, 40] });
        }
    });
    state.map.addLayer(state.markersCluster);
    setTimeout(() => { state.map.fire('load'); state.map.invalidateSize(); }, 800);
}

export function updateMapTiles() {
    const isDark = document.body.classList.contains('dark-mode');
    const url = isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    state.map.eachLayer(l => { if(l instanceof L.TileLayer) state.map.removeLayer(l); });
    L.tileLayer(url, { maxZoom: 19 }).addTo(state.map);
}

export function renderMarkers(list) { 
    state.markersCluster.clearLayers(); 
    list.forEach(l => { 
        let baseCat = l.categoria.split(' ')[0];
        if(baseCat === 'museo' || baseCat === 'paseos') baseCat = 'turismo';
        if(state.activeLayers[baseCat] === false) return;

        let iconClass = 'location-outline'; let colorClass = baseCat;
        if(l.categoria.includes('turismo') || l.categoria.includes('museo')) iconClass = 'camera';
        if(l.categoria.includes('comida') || l.categoria.includes('gastro')) iconClass = 'restaurant';
        if(l.categoria.includes('playa')) iconClass = 'umbrella';
        if(l.categoria.includes('estacionamiento')) { iconClass = 'car'; colorClass = 'gray'; }
        if(l.categoria.includes('parada')) { iconClass = 'bus'; colorClass = 'bus'; }
        if(l.categoria.includes('reportes')) { iconClass = 'warning'; colorClass = 'report'; }

        const customHtml = `<div class="pin-head ${colorClass}"><ion-icon name="${iconClass}"></ion-icon></div>`;
        const icon = L.divIcon({ className: `custom-pin`, html: customHtml, iconSize:[32,32], iconAnchor:[16,16] }); 
        const marker = L.marker([l.lat,l.lng],{icon});
        
        // Conexión con UI de script.js
        marker.on('click', () => window.abrirFicha(l));
        state.markersCluster.addLayer(marker); 
    }); 
}

export function iniciarGPS() { 
    if(navigator.geolocation) {
        navigator.geolocation.watchPosition(p => { 
            state.userCoords = { lat: p.coords.latitude, lng: p.coords.longitude }; 
            if(!state.userMarker) {
                const htmlIcon = `<div class="user-dir-cone"></div>`;
                state.userMarker = L.marker([state.userCoords.lat, state.userCoords.lng], { icon: L.divIcon({className:'user-dot', html: htmlIcon, iconSize: [18,18]}) }).addTo(state.map);
            } else {
                state.userMarker.setLatLng([state.userCoords.lat, state.userCoords.lng]);
            }
            if(state.isNavigating) state.map.panTo([state.userCoords.lat, state.userCoords.lng], {animate: true, duration: 1});
            
            if(state.alertaParadaActiva) {
                const distParada = getDistance(state.userCoords.lat, state.userCoords.lng, state.alertaParadaActiva.lat, state.alertaParadaActiva.lng);
                if(distParada <= 150) {
                    showToast(`🚨 ¡Estás a pocos metros de ${state.alertaParadaActiva.nombre}!`);
                    if(navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                    state.alertaParadaActiva = null; 
                }
            }
            if(window.actualizarBotonCheckin) window.actualizarBotonCheckin(); 
        }, (err) => { 
            let msg = "⚠️ No se pudo obtener tu ubicación.";
            if (err.code === 1) msg = "⚠️ Permiso GPS denegado. Revísalo en tu navegador.";
            if (err.code === 2) msg = "⚠️ Señal GPS no disponible en este momento.";
            if (err.code === 3) msg = "⚠️ Tiempo de espera agotado buscando señal.";
            showToast(msg);
        }, CONFIG.gpsOptions); 
    } else { showToast("⚠️ Tu dispositivo no soporta GPS."); }
}

export function centrarMapaUsuario() {
    if(state.userCoords) {
        state.map.flyTo([state.userCoords.lat, state.userCoords.lng], 16, { duration: 1.5 });
        showToast("📍 Estás aquí");
    } else {
        showToast("📡 Buscando señal GPS...");
        iniciarGPS();
    }
}

export function iniciarRuta(destinoParam) {
    let destinoLatLng;
    if(destinoParam === 'ficha' && state.currentPlace) {
        destinoLatLng = L.latLng(state.currentPlace.lat, state.currentPlace.lng);
        window.cerrarFicha();
    } else if (destinoParam === 'historica') destinoLatLng = L.latLng(-27.463049,-58.839644); 
    else if (destinoParam === 'costanera') destinoLatLng = L.latLng(-27.477179,-58.855176);

    if(!destinoLatLng) return showToast("⚠️ Destino no válido");
    if(!state.userCoords) return showToast("⚠️ Esperando GPS...");

    if(state.routingControl) state.map.removeControl(state.routingControl);
    showToast("🚗 Calculando ruta...");
    
    state.routingControl = L.Routing.control({
        waypoints: [ L.latLng(state.userCoords.lat, state.userCoords.lng), destinoLatLng ],
        routeWhileDragging: false, addWaypoints: false, showAlternatives: false,
        lineOptions: { styles: [{color: '#007AFF', opacity: 0.8, weight: 6}] },
        createMarker: () => null, language: 'es'
    }).addTo(state.map);

    state.routingControl.on('routesfound', e => {
        const s = e.routes[0].summary;
        document.getElementById('nav-time').innerText = Math.round(s.totalTime/60) + " min";
        document.getElementById('nav-dist').innerText = (s.totalDistance/1000).toFixed(1) + " km";
        document.getElementById('nav-ui-bottom').classList.add('active');
        state.isNavigating = true;
        state.map.flyTo([state.userCoords.lat, state.userCoords.lng], 17);
    });

    window.cambiarTab('map');
}

export function finalizarViaje() {
    if(state.routingControl) {
        state.map.removeControl(state.routingControl);
        state.routingControl = null;
    }
    document.getElementById('nav-ui-bottom').classList.remove('active');
    state.isNavigating = false;
}