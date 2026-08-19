/* ==========================================
   RUTA CORRENTINA - ULTIMATE EDITION v12.6
   Dev: Alejandro
   ========================================== */

import { 
    db, auth, functions, httpsCallable, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, limit, serverTimestamp, getDocs,
    onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile 
} from './firebase.js';

const CONFIG = {
    radioCheckin: 400, 
    gpsOptions: { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    defaultCenter: [-27.469, -58.830]
};

const PREMIOS = [
    { id: 1, nombre: "Descuento en Heladería", costo: 100 },
    { id: 2, nombre: "Paseo en Lancha Gratis", costo: 300 },
    { id: 3, nombre: "Cena VIP para 2", costo: 500 }
];

let state = {
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

document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('online', flushOfflineQueue);

async function initApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW Falló", err));
    }

    checkConnection();
    setupHeaderDate();

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.remove();
                if(state.map) state.map.invalidateSize(); 
            }, 600);
        } else {
            if(state.map) state.map.invalidateSize();
        }
    }, 1500);

    initMap();
    initTheme();
    
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
    
    window.addEventListener('resize', () => {
        if(state.map) setTimeout(() => state.map.invalidateSize(), 300);
    });
    
    onAuthStateChanged(auth, async (user) => {
        state.currentUser = user;
        if (user) {
            toggleAuthUI(true);

            const localFavsRaw = localStorage.getItem('localFavs');
            if (localFavsRaw) {
                try {
                    const localFavs = JSON.parse(localFavsRaw);
                    if (localFavs.length > 0) {
                        const userRef = doc(db, "users", user.uid);
                        const snap = await getDoc(userRef);
                        let userFavs = snap.exists() ? (snap.data().favoritos || []) : [];
                        
                        const mergedFavs = [...new Set([...userFavs, ...localFavs])];
                        
                        await setDoc(userRef, { favoritos: mergedFavs }, { merge: true });
                        localStorage.removeItem('localFavs'); 
                        showToast("🔄 Favoritos guardados sincronizados con tu cuenta.");
                    }
                } catch (e) {
                    console.error("Error migrando favoritos locales", e);
                }
            }

            await cargarPerfil(user);
        } else {
            toggleAuthUI(false);
            const localFavs = localStorage.getItem('localFavs');
            state.favoritos = localFavs ? JSON.parse(localFavs) : [];
        }
    });

    await fetchLugares();
    await cargarReportesComunitarios();
    iniciarGPS();
    fetchWeatherReal();
}

function handleOrientation(e) {
    let compass = e.webkitCompassHeading || Math.abs(e.alpha - 360);
    const dot = document.querySelector('.user-dir-cone');
    if(dot && compass) {
        dot.style.transform = `translate(-50%, -50%) rotate(${compass}deg)`;
    }
}

function setupHeaderDate() {
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
        const mateSvg = `
            <svg class="mate-svg-icon" viewBox="0 0 32 32" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 4L13 13.5" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M19 3L22 6" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M8 11H24C24 11 25.5 13 24 15H8C6.5 13 8 11 8 11Z" fill="#007AFF" opacity="0.25" stroke="#007AFF" stroke-width="2"/>
                <path d="M9 14C9 14 6 22 16 26C26 22 23 14 23 14H9Z" fill="#007AFF" stroke="#007AFF" stroke-width="2" stroke-linejoin="round"/>
                <path d="M12 22H20C20 24 19 26 16 26C13 26 12 24 12 22Z" fill="#007AFF"/>
            </svg>
        `;
        greetEl.innerHTML = `${saludo} <span class="mate-badge" title="¡Un buen mate correntino!">${mateSvg}</span>`;
    }
}

async function fetchLugares() {
    renderFeedSkeletons();
    try {
        const resp = await fetch('lugares.json');
        const data = await resp.json();
        state.lugares = flattenLugares(data);
        
        state.lugares.forEach(l => { if(!l.opensAt) { l.opensAt = 9; l.closesAt = 22; } });
        state.lugaresFiltrados = state.lugares;
        renderMarkers(state.lugares);
        renderFeed(state.lugares);
    } catch (e) {
        console.error(e);
        showToast("⚠️ Usando datos cacheados");
    }
}

async function cargarReportesComunitarios() {
    try {
        const querySnapshot = await getDocs(collection(db, "reportes"));
        state.reportes = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            state.reportes.push({
                nombre: data.tipo,
                categoria: "reportes",
                lat: data.lat,
                lng: data.lng,
                desc: data.descripcion || "Incidente reportado por la comunidad.",
                img: null,
                opensAt: 0, closesAt: 24
            });
        });
        state.lugares = [...state.lugares, ...state.reportes];
    } catch(e) {
        console.warn("No se pudieron cargar reportes remotos", e);
    }
}

function checkConnection() {
    const banner = document.getElementById('offline-banner');
    if(!navigator.onLine && banner) banner.classList.add('visible');
    window.addEventListener('offline', () => banner?.classList.add('visible'));
    window.addEventListener('online', () => {
        banner?.classList.remove('visible');
        showToast("✅ Conexión restablecida");
    });
}

async function flushOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem('offlineReviews') || '[]');
    if(queue.length === 0) return;
    showToast(`🔄 Subiendo ${queue.length} comentarios pendientes...`);
    const newQueue = [];
    for(const item of queue) {
        try { await addDoc(collection(db, "reviews"), item); } catch(e) { newQueue.push(item); }
    }
    localStorage.setItem('offlineReviews', JSON.stringify(newQueue));
}

async function fetchWeatherReal() {
    try {
        const lat = state.userCoords ? state.userCoords.lat : CONFIG.defaultCenter[0];
        const lng = state.userCoords ? state.userCoords.lng : CONFIG.defaultCenter[1];
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=auto`);
        const data = await res.json();
        if(data?.current) {
            document.getElementById('temp-val').innerText = `${Math.round(data.current.temperature_2m)}°C`;
            document.querySelector('.weather-in-bar').style.display = 'flex';
        }
    } catch (e) {}
}

function flattenLugares(data) {
    let out = [];
    if (Array.isArray(data)) {
        data.forEach(grupo => {
            Object.keys(grupo).forEach(categoria => {
                if(Array.isArray(grupo[categoria])) {
                    grupo[categoria].forEach(lugar => {
                        out.push({
                            ...lugar,
                            categoria: categoria,
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

function initMap() {
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
        showCoverageOnHover: false, 
        maxClusterRadius: 40,
        iconCreateFunction: function(cluster) {
            return L.divIcon({ html: `<div>${cluster.getChildCount()}</div>`, className: 'custom-cluster', iconSize: [40, 40] });
        }
    });
    state.map.addLayer(state.markersCluster);
    
    setTimeout(() => {
        state.map.fire('load');
        state.map.invalidateSize(); 
    }, 800);
}

function updateMapTiles() {
    const isDark = document.body.classList.contains('dark-mode');
    const url = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    state.map.eachLayer(l => { if(l instanceof L.TileLayer) state.map.removeLayer(l); });
    L.tileLayer(url, { maxZoom: 19 }).addTo(state.map);
}

window.toggleLayerPanel = () => {
    const panel = document.getElementById('layer-panel');
    panel.classList.toggle('hidden');
};

window.toggleLayer = (cat, show) => {
    state.activeLayers[cat] = show;
    ejecutarFiltros();
};

function renderMarkers(list) { 
    state.markersCluster.clearLayers(); 
    list.forEach(l => { 
        let baseCat = l.categoria.split(' ')[0];
        if(baseCat === 'museo' || baseCat === 'paseos') baseCat = 'turismo';
        if(state.activeLayers[baseCat] === false) return;

        let iconClass = 'location-outline';
        let colorClass = baseCat;
        
        if(l.categoria.includes('turismo') || l.categoria.includes('museo')) iconClass = 'camera';
        if(l.categoria.includes('comida') || l.categoria.includes('gastro')) iconClass = 'restaurant';
        if(l.categoria.includes('playa')) iconClass = 'umbrella';
        if(l.categoria.includes('estacionamiento')) { iconClass = 'car'; colorClass = 'gray'; }
        if(l.categoria.includes('parada')) { iconClass = 'bus'; colorClass = 'bus'; }
        if(l.categoria.includes('reportes')) { iconClass = 'warning'; colorClass = 'report'; }

        const customHtml = `
            <div class="pin-head ${colorClass}">
                <ion-icon name="${iconClass}"></ion-icon>
            </div>`;

        const icon = L.divIcon({ 
            className: `custom-pin`, 
            html: customHtml, 
            iconSize:[32,32], 
            iconAnchor:[16,16] 
        }); 
        
        const marker = L.marker([l.lat,l.lng],{icon});
        marker.on('click', () => abrirFicha(l));
        state.markersCluster.addLayer(marker); 
    }); 
}

let debounceTimer;
window.filtrarInput = (val) => { 
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        state.busquedaActual = val.toLowerCase(); 
        ejecutarFiltros(); 
        mostrarSugerencias(state.busquedaActual);
    }, 300);
};

function mostrarSugerencias(val) {
    const box = document.getElementById('search-results');
    if(!val) { box.classList.add('hidden'); return; }
    
    const sugerencias = state.lugares.filter(l => l.nombre.toLowerCase().includes(val)).slice(0, 5);
    if(sugerencias.length === 0) { box.classList.add('hidden'); return; }
    
    box.innerHTML = sugerencias.map(l => `
        <div class="search-result-item" onclick="seleccionarSugerencia('${l.nombre}')">
            <ion-icon name="location-outline"></ion-icon> <span>${l.nombre}</span>
        </div>
    `).join('');
    
    box.classList.remove('hidden');
}

window.seleccionarSugerencia = (nombre) => {
    document.getElementById('buscador-input').value = nombre;
    document.getElementById('search-results').classList.add('hidden');
    state.busquedaActual = nombre.toLowerCase();
    ejecutarFiltros();
    abrirFichaNombre(nombre);
};

window.filtrarBoton = (cat, btn) => {
    state.filtroActual = cat.toLowerCase();
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active'); 
    ejecutarFiltros();
    if(navigator.vibrate) navigator.vibrate(10);
};

function ejecutarFiltros() {
    const { filtroActual, busquedaActual, lugares } = state;
    const horaActual = new Date().getHours();
    
    const res = lugares.filter(l => {
        let catMatch = true;
        if(filtroActual === 'abierto') {
            catMatch = (l.opensAt <= horaActual && l.closesAt > horaActual);
        } else if (filtroActual === 'favoritos') {
            catMatch = state.favoritos.includes(l.nombre);
        } else if (filtroActual !== 'todos') {
            catMatch = JSON.stringify(l).toLowerCase().includes(filtroActual);
        }
        const textMatch = !busquedaActual || l.nombre.toLowerCase().includes(busquedaActual);
        return catMatch && textMatch;
    });
    
    state.lugaresFiltrados = res;
    renderMarkers(res);
    renderFeed(res);
}

window.centrarMapaUsuario = () => {
    if(state.userCoords) {
        state.map.flyTo([state.userCoords.lat, state.userCoords.lng], 16, { duration: 1.5 });
        showToast("📍 Estás aquí");
    } else {
        showToast("📡 Buscando señal GPS...");
        iniciarGPS();
    }
};

window.iniciarGPS = () => { 
    if(navigator.geolocation) {
        navigator.geolocation.watchPosition(p => { 
            state.userCoords = { lat: p.coords.latitude, lng: p.coords.longitude }; 
            
            if(!state.userMarker) {
                const htmlIcon = `<div class="user-dir-cone"></div>`;
                state.userMarker = L.marker([state.userCoords.lat, state.userCoords.lng], {
                    icon: L.divIcon({className:'user-dot', html: htmlIcon, iconSize: [18,18]})
                }).addTo(state.map);
            } else {
                state.userMarker.setLatLng([state.userCoords.lat, state.userCoords.lng]);
            }
            
            if(state.isNavigating) {
                state.map.panTo([state.userCoords.lat, state.userCoords.lng], {animate: true, duration: 1});
            }

            if(state.alertaParadaActiva) {
                const distParada = getDistance(state.userCoords.lat, state.userCoords.lng, state.alertaParadaActiva.lat, state.alertaParadaActiva.lng);
                if(distParada <= 150) {
                    showToast(`🚨 ¡Estás a pocos metros de ${state.alertaParadaActiva.nombre}!`);
                    if(navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                    state.alertaParadaActiva = null; 
                }
            }

            actualizarBotonCheckin(); 
        }, (err) => { 
            console.warn("GPS Warn", err); 
            let msg = "⚠️ No se pudo obtener tu ubicación.";
            if (err.code === 1) msg = "⚠️ Permiso GPS denegado. Revísalo en tu navegador.";
            if (err.code === 2) msg = "⚠️ Señal GPS no disponible en este momento.";
            if (err.code === 3) msg = "⚠️ Tiempo de espera agotado buscando señal.";
            showToast(msg);
        }, CONFIG.gpsOptions); 
    } else {
        showToast("⚠️ Tu dispositivo no soporta GPS.");
    }
};

window.abrirModalReporte = () => { document.getElementById('modal-reporte').classList.add('active'); };
window.cerrarModalReporte = () => { document.getElementById('modal-reporte').classList.remove('active'); };

window.enviarReporte = async () => {
    if(!state.userCoords) return showToast("⚠️ Esperando señal GPS...");
    const tipo = document.getElementById('tipo-reporte').value;
    const desc = document.getElementById('desc-reporte').value.trim();

    const nuevoReporte = {
        tipo: tipo,
        descripcion: desc || tipo,
        lat: state.userCoords.lat,
        lng: state.userCoords.lng,
        fecha: serverTimestamp(),
        usuario: state.currentUser ? state.currentUser.displayName || 'Anónimo' : 'Anónimo'
    };

    try {
        await addDoc(collection(db, "reportes"), nuevoReporte);
        showToast("⚠️ ¡Incidente reportado con éxito!");
        cerrarModalReporte();
        document.getElementById('desc-reporte').value = '';
        await cargarReportesComunitarios();
        renderMarkers(state.lugares);
    } catch(e) {
        showToast("❌ Error al enviar reporte");
    }
};

window.iniciarRuta = (destinoParam) => {
    let destinoLatLng;
    if(destinoParam === 'ficha' && state.currentPlace) {
        destinoLatLng = L.latLng(state.currentPlace.lat, state.currentPlace.lng);
        cerrarFicha();
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

    cambiarTab('map');
};

window.finalizarViaje = () => {
    if(state.routingControl) {
        state.map.removeControl(state.routingControl);
        state.routingControl = null;
    }
    document.getElementById('nav-ui-bottom').classList.remove('active');
    state.isNavigating = false;
};

window.refreshFeed = () => {
    renderFeedSkeletons();
    setTimeout(() => { fetchLugares(); showToast("Datos actualizados"); }, 1000);
}

function renderFeedSkeletons() {
    const c = document.getElementById('feed-container');
    if(c) c.innerHTML = Array(4).fill('<div class="skeleton" style="height:180px; border-radius:28px;"></div>').join('');
}

function renderFeed(list) { 
    const c = document.getElementById('feed-container'); 
    if(!c) return;
    if(!list || list.length === 0) { 
        c.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:20px; color:#888">No hay lugares para mostrar.</div>'; 
        return; 
    } 

    let renderList = [...list];
    if(state.userCoords) {
        renderList.sort((a, b) => {
            const distA = getDistance(state.userCoords.lat, state.userCoords.lng, a.lat, a.lng);
            const distB = getDistance(state.userCoords.lat, state.userCoords.lng, b.lat, b.lng);
            return distA - distB;
        });
    }
    
    c.innerHTML = renderList.map((l, index) => { 
        const isFav = state.favoritos.includes(l.nombre); 
        
        let catIcon = 'location-outline';
        let colorClass = l.categoria.split(' ')[0];
        
        if(l.categoria.includes('turismo') || l.categoria.includes('museo')) catIcon = 'camera';
        if(l.categoria.includes('gastronomia') || l.categoria.includes('comida')) catIcon = 'restaurant';
        if(l.categoria.includes('playa')) catIcon = 'umbrella';
        if(l.categoria.includes('estacionamiento')) { catIcon = 'car'; colorClass = 'gray'; }
        if(l.categoria.includes('parada')) { catIcon = 'bus'; colorClass = 'bus'; }
        if(l.categoria.includes('reportes')) { catIcon = 'warning'; colorClass = 'report'; }

        const imgUrl = l.img || 'https://via.placeholder.com/400x300?text=Ruta+Correntina';
        const cardClass = index === 0 ? 'card-modern card-hero' : 'card-modern';
        
        let distanciaTxt = '';
        if(state.userCoords) {
            const meters = getDistance(state.userCoords.lat, state.userCoords.lng, l.lat, l.lng);
            const km = meters < 1000 ? `${Math.round(meters)} m` : `${(meters/1000).toFixed(1)} km`;
            distanciaTxt = `<span class="card-dist-badge"><ion-icon name="navigate"></ion-icon> ${km}</span>`;
        }

        return `
        <div class="${cardClass}" onclick="event.target.closest('.card-fav-btn') ? toggleFavorite('${l.nombre}') : abrirFichaNombre('${l.nombre}')">
            <img src="${imgUrl}" loading="lazy" alt="${l.nombre}">
            
            <div class="card-gradient"></div>

            <span class="card-badge-cat ${colorClass}">
                <ion-icon name="${catIcon}"></ion-icon> 
                ${l.categoria.split(' ')[0]}
            </span>

            ${distanciaTxt}

            <button class="card-fav-btn ${isFav?'active':''}">
                <ion-icon name="${isFav ? 'heart' : 'heart-outline'}"></ion-icon>
            </button>

            <div class="card-info-box">
                <h3>${l.nombre}</h3>
                <div class="card-actions-mini">
                    <span onclick="event.stopPropagation(); abrirFichaNombre('${l.nombre}')"><ion-icon name="information-circle"></ion-icon> Ver</span>
                    <span onclick="event.stopPropagation(); cambiarTab('map'); setTimeout(()=>state.map.flyTo([${l.lat},${l.lng}],16),300)"><ion-icon name="map"></ion-icon> Mapa</span>
                </div>
            </div>
        </div>`;
    }).join(''); 
}

window.abrirFicha = (l) => {
    state.currentPlace = l;
    const isFav = state.favoritos.includes(l.nombre);
    
    const bgStyle = l.img ? `<img src="${l.img}" loading="lazy" onerror="this.parentElement.style.height='70px'; this.style.display='none';">` : ``;
    const heroHeightStyle = l.img ? `` : `height: 70px; background: transparent;`;

    let menuHTML = '';
    if(l.menu && l.menu.length > 0) {
        menuHTML = `
            <div class="restaurant-menu">
                <h3>Menú Destacado</h3>
                ${l.menu.map(m => `
                    <div class="menu-item-row">
                        <span>${m.item}</span>
                        <strong>$${m.precio.toLocaleString('es-AR')}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    let parkingDispoHTML = '';
    if(l.categoria.includes('estacionamiento')) {
        const max = l.capacidadMax || 50;
        const ocupados = Math.floor(Math.random() * max);
        const libres = max - ocupados;
        const colorDispo = libres > 15 ? 'var(--success)' : (libres > 5 ? '#FF9500' : 'var(--danger)');
        
        parkingDispoHTML = `
            <div style="background: rgba(0,0,0,0.03); padding: 15px; border-radius: 16px; margin-top: 15px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(0,0,0,0.05);">
                <div style="display:flex; align-items:center; gap: 15px;">
                    <div style="width:45px; height:45px; border-radius:12px; background:${colorDispo}; color:white; display:flex; align-items:center; justify-content:center; font-size:1.3rem; box-shadow: 0 4px 10px ${colorDispo}40;">
                        <ion-icon name="car"></ion-icon>
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:800; font-size:1.1rem; color:var(--text-main);">${libres} Libres</span>
                        <small style="color:var(--text-sec); font-weight: 500;">de ${max} espacios totales</small>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <span style="font-size:0.75rem; font-weight:800; color:${colorDispo}; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:8px;">EN VIVO</span>
                </div>
            </div>
        `;
    }

    let lineasHTML = '';
    if(l.lineas && l.lineas.length > 0) {
        lineasHTML = `
            <div style="margin-top: 15px; background: rgba(88,86,214,0.05); padding: 15px; border-radius: 16px; border: 1px solid rgba(88,86,214,0.1);">
                <h3 style="font-size: 0.85rem; color: #5856D6; text-transform: uppercase; margin: 0 0 10px 0; font-weight: 800;"><ion-icon name="git-branch"></ion-icon> Líneas que pasan por aquí</h3>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                    ${l.lineas.map(linea => `<span onclick="filtrarPorLinea('${linea}')" style="background: linear-gradient(135deg, #5856D6, #AF52DE); color: white; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor:pointer; box-shadow: 0 2px 8px rgba(88,86,214,0.3);">Línea ${linea}</span>`).join('')}
                </div>
                <button onclick="activarAlertaParada('${l.nombre.replace(/'/g, "")}', ${l.lat}, ${l.lng})" class="btn-action secondary" style="width: 100%; background: rgba(88,86,214,0.1); color: #5856D6; font-size: 0.9rem; padding: 10px;">
                    <ion-icon name="notifications"></ion-icon> Avisarme al llegar a esta parada
                </button>
            </div>
        `;
    }

    let audioGuiaHTML = '';
    if(l.desc && (l.categoria.includes('turismo') || l.categoria.includes('museo') || l.categoria.includes('paseos'))) {
        audioGuiaHTML = `
            <button onclick="reproducirAudioGuia('${l.nombre.replace(/'/g, "")}', '${l.desc.replace(/'/g, "")}')" class="btn-action secondary" style="margin-top: 12px; background: rgba(0,122,255,0.1); color: var(--primary);">
                <ion-icon name="volume-high"></ion-icon> Escuchar Audio-Guía
            </button>
        `;
    }

    document.getElementById('ficha-lugar').innerHTML = `
        <div class="sheet-grabber"></div>
        <div class="ficha-hero" style="${heroHeightStyle}">
            ${bgStyle}
            <button class="btn-back-float" onclick="cerrarFicha()"><ion-icon name="close"></ion-icon></button>
            <button class="btn-fav-float ${isFav?'active':''}" onclick="toggleFavorite('${l.nombre}')"><ion-icon name="${isFav ? 'heart' : 'heart-outline'}"></ion-icon></button>
        </div>
        <div class="ficha-content">
            <div class="ficha-header">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="tag-cat">${l.categoria.split(' ')[0]}</span>
                    ${l.destacado ? '<span class="tag-top">⭐ TOP</span>' : ''}
                </div>
                <h1>${l.nombre}</h1>
                <p>${l.desc || 'Explora este lugar increíble.'}</p>
                ${audioGuiaHTML}
            </div>
            
            ${parkingDispoHTML}
            ${lineasHTML}

            <div class="action-grid" style="margin-top: 15px;">
                <button onclick="iniciarRuta('ficha')" class="btn-action primary"><ion-icon name="navigate"></ion-icon> IR AHORA</button>
                <button onclick="compartirLugar('${l.nombre}')" class="btn-action secondary"><ion-icon name="share-social"></ion-icon></button>
                ${l.wp ? `<a href="https://wa.me/${l.wp}" target="_blank" class="btn-action whatsapp"><ion-icon name="logo-whatsapp"></ion-icon></a>` : ''}
            </div>
            ${menuHTML}
            <button id="btn-checkin-dynamic" onclick="triggerCheckIn()" class="btn-checkin-big disabled"><ion-icon name="radio"></ion-icon> <span>Ubicando...</span></button>
            <input type="file" id="foto-checkin" accept="image/*" capture="environment" style="display:none" onchange="procesarFotoCheckin(this)">
            <div class="comments-section">
                <h3>Reseñas</h3>
                <div class="review-input-box"><input type="text" id="input-review" placeholder="Deja tu opinión..."><button onclick="enviarComentario()"><ion-icon name="send"></ion-icon></button></div>
                <div id="lista-comentarios">Cargando...</div>
            </div>
        </div>`;
    
    document.getElementById('ficha-lugar').classList.add('open');
    actualizarBotonCheckin();
    cargarComentarios(l.nombre);
};

window.activarAlertaParada = (nombre, lat, lng) => {
    state.alertaParadaActiva = { nombre, lat, lng };
    cerrarFicha();
    showToast(`🔔 Alerta activada: Te avisaremos al llegar a ${nombre}`);
};

window.reproducirAudioGuia = (titulo, texto) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Te presentamos ${titulo}. ${texto}`);
        utterance.lang = 'es-AR';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        showToast("🔊 Reproduciendo audio-guía turística...");
    } else {
        showToast("⚠️ Tu navegador no soporta audio-guía");
    }
};

window.filtrarPorLinea = (linea) => {
    cerrarFicha();
    cambiarTab('map');
    const filtrados = state.lugares.filter(l => l.lineas && l.lineas.includes(linea));
    state.lugaresFiltrados = filtrados;
    renderMarkers(filtrados);
    showToast(`🚌 Filtrando por Línea ${linea}`);
};

window.cerrarFicha = () => { document.getElementById('ficha-lugar').classList.remove('open'); state.currentPlace = null; };
window.destinoMagico = () => {
    const opciones = state.lugares.filter(l => !l.categoria.includes('reportes'));
    const random = opciones[Math.floor(Math.random() * opciones.length)];
    if(random) { abrirFichaNombre(random.nombre); showToast(`✨ ¡El destino eligió: ${random.nombre}!`); }
};

window.abrirFichaNombre = (n) => { 
    const l = state.lugares.find(x=>x.nombre===n); 
    if(l) { cambiarTab('map'); setTimeout(()=>{ state.map.flyTo([l.lat,l.lng],16); abrirFicha(l); },300); } 
};

// --- NUEVO: SISTEMA DE PERFIL MEJORADO AL MÁXIMO ---
async function cargarPerfil(u) {
    const docRef = doc(db, "users", u.uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        const d = snap.data();
        state.visitados = d.visitados || [];
        state.favoritos = d.favoritos || [];
        
        const userName = d.nombre || u.displayName || 'Explorador';
        const userAvatarUrl = d.avatar || `https://ui-avatars.com/api/?name=${userName}&background=007AFF&color=fff&size=128&bold=true`;
        
        document.getElementById('user-name').innerText = userName;
        document.getElementById('user-avatar').src = userAvatarUrl;
        document.getElementById('header-avatar').src = userAvatarUrl;

        // Cálculos de Experiencia y Niveles
        const xp = state.visitados.length * 100;
        const lvl = Math.floor(xp / 500) + 1;
        const maxXP = lvl * 500;
        const currentLvlXP = xp % 500;
        const pct = Math.min(100, (currentLvlXP / 500) * 100);
        
        // Asignación de Roles según Nivel
        let rolStr = "Turista Local";
        let rolColor = "rgba(0,0,0,0.05)";
        if(lvl >= 2) { rolStr = "Aventurero"; rolColor = "rgba(0, 122, 255, 0.15); color: #007AFF;"; }
        if(lvl >= 5) { rolStr = "Guía Local"; rolColor = "rgba(52, 199, 89, 0.15); color: #34C759;"; }
        if(lvl >= 10) { rolStr = "Maestro Correntino"; rolColor = "linear-gradient(90deg, #FFD60A, #FF9F0A); color: black;"; }

        document.getElementById('level-badge').innerText = `Lv. ${lvl}`;
        document.getElementById('badge-role').innerHTML = rolStr;
        document.getElementById('badge-role').style = `background: ${rolColor}`;
        
        document.getElementById('current-xp').innerText = `${xp} / ${maxXP} XP`;
        
        // Animación de la barra de progreso
        const barFill = document.getElementById('xp-bar-fill');
        barFill.style.width = '0%';
        setTimeout(() => { barFill.style.width = `${pct}%`; }, 300);
        
        // Puntos
        const puntos = state.visitados.length * 10;
        document.getElementById('tech-points').innerText = puntos.toLocaleString('es-AR');
        document.getElementById('canje-points').innerText = puntos.toLocaleString('es-AR');

        const walletUser = document.getElementById('wallet-user-name');
        if (walletUser) walletUser.innerText = userName;

        document.getElementById('stat-visitados').innerText = state.visitados.length;
        document.getElementById('stat-badges-count').innerText = Math.floor(state.visitados.length / 3); 

        // Lógica de Álbum de Fotos con Empty State
        const galleryItem = document.getElementById('gallery-item');
        const miniGrid = document.getElementById('passport-grid-mini');
        
        if(state.visitados && state.visitados.length > 0) {
            const ultimas = state.visitados.slice(-10).reverse(); 
            miniGrid.innerHTML = ultimas.map(v => `<img src="${v.foto}" title="${v.nombre}" loading="lazy">`).join('');
        } else {
            miniGrid.innerHTML = `
                <div class="album-empty-state">
                    <ion-icon name="images-outline"></ion-icon>
                    <p>Tus fotos de check-in aparecerán aquí.</p>
                    <button onclick="cambiarTab('list')">Explorar lugares</button>
                </div>
            `;
        }
        
        renderCoupons(puntos);
    }
}

function renderCoupons(puntosUser) {
    const container = document.getElementById('canje-list');
    container.innerHTML = PREMIOS.map(p => {
        const puede = puntosUser >= p.costo;
        return `
        <div class="coupon-card ${puede ? '' : 'disabled'}">
            <div class="coupon-left">
                <span class="coupon-cost">${p.costo} PTS</span>
                <h3>${p.nombre}</h3>
            </div>
            <button class="coupon-btn" onclick="canjearPremio(${p.id})">${puede ? 'CANJEAR' : 'FALTA'}</button>
        </div>`;
    }).join('');
}

window.canjearPremio = (id) => {
    alert("¡Muestra este mensaje en el local adherido para validar tu descuento!");
}

window.toggleRanking = async (show) => {
    const modal = document.getElementById('modal-ranking');
    if(show) {
        modal.classList.add('open');
        const list = document.getElementById('ranking-list');
        list.innerHTML = '<div class="skeleton" style="height:50px;margin-bottom:10px;"></div>'.repeat(3);
        
        const q = query(collection(db, "users"), limit(10));
        try {
            const querySnapshot = await getDocs(q);
            let users = [];
            querySnapshot.forEach(doc => {
                const d = doc.data();
                users.push({ name: d.nombre || 'Anónimo', xp: (d.visitados?.length || 0) * 100 });
            });
            users.sort((a,b) => b.xp - a.xp);

            list.innerHTML = users.map((u, i) => `
                <div class="rank-item">
                    <div class="rank-pos top-${i+1}">${i+1}</div>
                    <div class="rank-avatar"></div>
                    <div class="rank-info"><strong>${u.name}</strong><small>Explorador</small></div>
                    <div class="rank-xp">${u.xp} XP</div>
                </div>
            `).join('');
        } catch(e) { list.innerHTML = "Error al cargar ranking."; }
    } else {
        modal.classList.remove('open');
    }
}

window.toggleCanje = (show) => {
    const modal = document.getElementById('modal-canje');
    show ? modal.classList.add('open') : modal.classList.remove('open');
}

/* --- UTILS --- */
function toggleAuthUI(isLoggedIn) {
    const authContainer = document.getElementById('auth-container');
    const profileContent = document.getElementById('user-profile-content');
    if(isLoggedIn) {
        if(authContainer) authContainer.style.display = 'none';
        if(profileContent) profileContent.style.display = 'block';
    } else {
        if(authContainer) authContainer.style.display = 'flex';
        if(profileContent) profileContent.style.display = 'none';
    }
}

function getDistance(lat1,lon1,lat2,lon2) { const R=6371e3, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180, a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
window.showToast = (m) => { const t=document.createElement('div'); t.className='toast'; t.innerText=m; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(),3000); };
window.initTheme = () => { 
    const isDark = localStorage.getItem('theme')==='dark';
    if(isDark) document.body.classList.add('dark-mode'); 
    document.getElementById('dark-mode-toggle').onclick = () => {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        updateMapTiles();
    };
};

window.cambiarTab = (id) => {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const indices = { 'map':0, 'list':1, 'profile':2 };
    document.querySelectorAll('.tab-btn')[indices[id]].classList.add('active');
    
    if(id==='map') setTimeout(()=>state.map.invalidateSize(), 500);
};

window.toggleAuthMode = () => { const t = document.getElementById('auth-header-text'); const isReg = t.innerText==='Accede a tu pasaporte digital'; t.innerText=isReg?'Crea tu cuenta gratis':'Accede a tu pasaporte digital'; document.getElementById('btn-submit').innerText=isReg?'Registrarse':'Entrar'; document.getElementById('toggle-text').innerText=isReg?'¿Ya tienes cuenta?':'Crear cuenta'; };
window.handleSubmit = (e) => { 
    e.preventDefault(); 
    const em=document.getElementById('email-input').value; 
    const ps=document.getElementById('pass-input').value; 
    const isReg=document.getElementById('btn-submit').innerText==='Registrarse'; 
    if(isReg) {
        createUserWithEmailAndPassword(auth,em,ps)
            .then(c=>{ updateProfile(c.user,{displayName:'Viajero'}); setDoc(doc(db,"users",c.user.uid),{visitados:[]}); })
            .catch(e=>showToast("Error: " + e.message)); 
    } else {
        signInWithEmailAndPassword(auth,em,ps).catch(e=> showToast("Credenciales incorrectas")); 
    }
};
window.cerrarSesion = () => signOut(auth).then(()=>window.location.reload());

window.toggleFavorite = async (n) => { 
    const idx = state.favoritos.indexOf(n); 
    let isFav = false;

    if(idx > -1) {
        state.favoritos.splice(idx, 1); 
        showToast("💔 Eliminado de favoritos");
    } else {
        state.favoritos.push(n); 
        isFav = true;
        showToast("❤️ ¡Agregado a favoritos!");
    } 

    if(state.currentUser) {
        await setDoc(doc(db, "users", state.currentUser.uid), { favoritos: state.favoritos }, { merge: true });
    } else {
        localStorage.setItem('localFavs', JSON.stringify(state.favoritos));
    } 

    document.querySelectorAll('.card-modern').forEach(card => {
        const title = card.querySelector('h3').innerText;
        if(title === n) {
            const btn = card.querySelector('.card-fav-btn');
            const icon = btn.querySelector('ion-icon');
            if(isFav) {
                btn.classList.add('active');
                icon.setAttribute('name', 'heart');
            } else {
                btn.classList.remove('active');
                icon.setAttribute('name', 'heart-outline');
            }
        }
    });

    if (state.currentPlace && state.currentPlace.nombre === n) {
        const btnFicha = document.querySelector('.btn-fav-float');
        if (btnFicha) {
            const iconFicha = btnFicha.querySelector('ion-icon');
            if(isFav) {
                btnFicha.classList.add('active');
                iconFicha.setAttribute('name', 'heart');
            } else {
                btnFicha.classList.remove('active');
                iconFicha.setAttribute('name', 'heart-outline');
            }
        }
    }
};

window.compartirLugar = (n) => { if (navigator.share) { navigator.share({ title: 'Ruta Correntina', text: `¡Mira: ${n}!`, url: window.location.href }).catch(console.error); } else { showToast("Link copiado"); } };
window.triggerCheckIn = () => { const btn = document.getElementById('btn-checkin-dynamic'); if(btn.classList.contains('active')) document.getElementById('foto-checkin').click(); };
window.procesarFotoCheckin = (i) => { if(i.files[0]) { const r = new FileReader(); r.onload=(e)=>confirmarCheckIn(e.target.result); r.readAsDataURL(i.files[0]); }};
async function confirmarCheckIn(f) { 
    state.visitados.push({ nombre: state.currentPlace.nombre, date: new Date().toISOString(), foto:f }); 
    if(state.currentUser) await setDoc(doc(db,"users",state.currentUser.uid),{visitados:state.visitados},{merge:true}); 
    if(navigator.vibrate) navigator.vibrate([100,50,100]); 
    showToast(`🎉 +100 XP: ${state.currentPlace.nombre}`); 
    actualizarBotonCheckin(); 
    cargarPerfil(state.currentUser); 
}
function actualizarBotonCheckin() { 
    const btn = document.getElementById('btn-checkin-dynamic'); 
    if(!btn || !state.currentPlace || !state.userCoords) return; 
    const d = getDistance(state.userCoords.lat, state.userCoords.lng, state.currentPlace.lat, state.currentPlace.lng); 
    if(state.visitados.some(v=>v.nombre===state.currentPlace.nombre)) { 
        btn.className = "btn-checkin-big enabled"; btn.innerHTML="✅ VISITADO"; btn.style.background='var(--success-grad)'; 
    } else if(d <= CONFIG.radioCheckin) { 
        btn.className = "btn-checkin-big enabled active"; btn.innerHTML = "📸 FOTO CHECK-IN"; btn.style.background='var(--primary-grad)'; 
    } else { 
        btn.className = "btn-checkin-big disabled"; btn.innerHTML = `🚶 ACÉRCATE (${Math.round(d)}m)`; btn.style.background='#ccc'; 
    } 
}
window.enviarComentario = async () => {
    if(!state.currentUser) return showToast("Inicia sesión");
    const t = document.getElementById('input-review').value;
    if(!t) return;
    const reviewData = { lugar: state.currentPlace.nombre, usuario: state.currentUser.displayName || 'U', texto: t, fecha: serverTimestamp(), uid: state.currentUser.uid };
    if(navigator.onLine) { await addDoc(collection(db, "reviews"), reviewData); showToast("Enviado"); } else { const queue = JSON.parse(localStorage.getItem('offlineReviews') || '[]'); queue.push(reviewData); localStorage.setItem('offlineReviews', JSON.stringify(queue)); showToast("💾 Guardado (se enviará al conectar)"); }
    document.getElementById('input-review').value='';
    cargarComentarios(state.currentPlace.nombre);
};
window.cargarComentarios = async(l) => {
    const b = document.getElementById('lista-comentarios');
    b.innerHTML = '<div class="skeleton" style="height:30px; margin-bottom:5px;"></div>'.repeat(3); 
    try {
        if(navigator.onLine) {
            const q = query(collection(db, "reviews"), where("lugar","==",l), orderBy("fecha","desc"), limit(5));
            const s = await getDocs(q);
            b.innerHTML = s.empty ? '<small>Sé el primero en comentar</small>' : '';
            s.forEach(d=>{b.innerHTML+=`<div class="review-item"><b>${d.data().usuario}</b>: ${d.data().texto}</div>`});
        } else { b.innerHTML = '<small>Modo Offline: No se pueden cargar reseñas.</small>'; }
    } catch(e){ b.innerHTML = ''; }
};

window.abrirEditarPerfil = () => {
    const currentName = document.getElementById('user-name').innerText;
    const input = document.getElementById('input-nuevo-nombre');
    input.value = currentName;
    document.getElementById('modal-edit-profile').classList.add('active');
    setTimeout(() => input.focus(), 100);
};

window.cerrarEditarPerfil = () => {
    document.getElementById('modal-edit-profile').classList.remove('active');
};

window.guardarNuevoNombre = async () => {
    const nuevoNombre = document.getElementById('input-nuevo-nombre').value.trim();
    if(nuevoNombre && nuevoNombre !== "") {
        if(state.currentUser) {
            await setDoc(doc(db, "users", state.currentUser.uid), { nombre: nuevoNombre }, { merge: true });
            cargarPerfil(state.currentUser);
            showToast("✅ Perfil actualizado");
        }
    }
    cerrarEditarPerfil();
};

window.procesarNuevoAvatar = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Image = e.target.result;
            document.getElementById('user-avatar').src = base64Image;
            document.getElementById('header-avatar').src = base64Image;
            if(state.currentUser) {
                try {
                    showToast("⏳ Subiendo avatar...");
                    await setDoc(doc(db, "users", state.currentUser.uid), { avatar: base64Image }, { merge: true });
                    showToast("✅ Avatar actualizado");
                } catch (error) {
                    showToast("❌ Error al guardar");
                    cargarPerfil(state.currentUser);
                }
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

/* --- IA GEMINI (EN BACKEND) --- */
window.toggleChat = () => {
    const chat = document.getElementById('chat-widget');
    if (!chat) return;
    const isHidden = chat.classList.contains('chat-hidden');
    if (isHidden) {
        chat.classList.remove('chat-hidden');
        chat.classList.add('chat-visible');
        setTimeout(() => document.getElementById('user-msg').focus(), 300);
    } else {
        chat.classList.remove('chat-visible');
        chat.classList.add('chat-hidden');
    }
};

window.handleEnter = (e) => {
    if (e.key === 'Enter') enviarMensajeIA();
};

window.enviarMensajeIA = async () => {
    const input = document.getElementById('user-msg');
    const btn = document.getElementById('btn-send-ai');
    const textoUsuario = input.value.trim();
    if (!textoUsuario) return;

    addMessage(textoUsuario, 'user');
    input.value = '';
    input.disabled = true;
    if(btn) btn.disabled = true;
    
    const loadingId = addMessage("Conectando... 🛰️", 'bot', true);

    try {
        const infoLugares = state.lugares.slice(0, 15).map(l => l.nombre).join(', ');
        
        const chatConGemini = httpsCallable(functions, 'chatConGemini');
        const resultado = await chatConGemini({
            textoUsuario: textoUsuario,
            infoLugares: infoLugares
        });

        const respuestaBot = resultado.data.respuesta;

        removeMessage(loadingId);
        addMessage(respuestaBot, 'bot');
    } catch (error) {
        console.error("Error conectando con la IA:", error);
        removeMessage(loadingId);
        addMessage("Hubo un error de conexión 🧉.", 'bot');
    } finally {
        input.disabled = false;
        if(btn) btn.disabled = false;
        input.focus();
    }
};

function addMessage(text, sender, isLoading = false) {
    const chatBody = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'user-msg' : 'bot-msg';
    
    let format = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    
    if (isLoading) {
        div.id = 'loading-msg';
        div.innerHTML = '<ion-icon name="sync" class="spin-anim"></ion-icon> Pensando...';
    } else {
        div.innerHTML = (sender === 'bot') ? format : text;
    }
    
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div.id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}