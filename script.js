/* ==========================================
   RUTA CORRENTINA - ULTIMATE EDITION v5.3
   Dev: Alejandro (TechFix)
   ========================================== */

import { 
    db, auth, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, limit, serverTimestamp, getDocs,
    onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile 
} from './firebase.js';

// --- CONFIGURACIÓN ---
const CONFIG = {
    radioCheckin: 400, 
    radioNotificacion: 500,
    gpsOptions: { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    defaultCenter: [-27.469, -58.830], 
    techFixCoords: [-27.469, -58.830] 
};

const PREMIOS = [
    { id: 1, nombre: "10% OFF en Reparación", costo: 100 },
    { id: 2, nombre: "Limpieza de Puerto Gratis", costo: 300 },
    { id: 3, nombre: "Vidrio Templado Gratis", costo: 500 }
];

// --- ESTADO GLOBAL ---
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
    filtroActual: 'todos',
    busquedaActual: '',
    notificadoTechFix: false
};

// --- INICIO ---
document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('online', flushOfflineQueue);

async function initApp() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
    checkConnection();
    setupHeaderDate();

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 600);
        }
    }, 1500);

    initMap();
    initTheme();
    
    onAuthStateChanged(auth, async (user) => {
        state.currentUser = user;
        if (user) {
            toggleAuthUI(true);
            await cargarPerfil(user);
        } else {
            toggleAuthUI(false);
            const localFavs = localStorage.getItem('localFavs');
            state.favoritos = localFavs ? JSON.parse(localFavs) : [];
        }
    });

    await fetchLugares();
    iniciarGPS();
    fetchWeatherReal();
}

function setupHeaderDate() {
    const d = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'short' };
    const dateStr = d.toLocaleDateString('es-ES', options);
    const hour = d.getHours();
    
    let saludo = "Hola, Viajero";
    if(hour >= 6 && hour < 12) saludo = "Buenos días ☀️";
    else if(hour >= 12 && hour < 20) saludo = "Buenas tardes 🧉";
    else saludo = "Buenas noches 🌙";

    const dateEl = document.getElementById('date-display');
    const greetEl = document.getElementById('greeting-display');
    
    if(dateEl) dateEl.innerText = dateStr;
    if(greetEl) greetEl.innerText = saludo;
}

async function fetchLugares() {
    renderFeedSkeletons();
    try {
        const resp = await fetch('lugares.json');
        const data = await resp.json();
        state.lugares = flattenLugares(data);
        
        if(!state.lugares.some(l => l.nombre.toLowerCase().includes('techfix'))) {
            state.lugares.unshift({
                nombre: "TechFix Taller",
                categoria: "techfix servicios",
                lat: CONFIG.techFixCoords[0],
                lng: CONFIG.techFixCoords[1],
                desc: "Servicio técnico oficial. Reparación de PC, Celulares y Consolas.",
                img: null,
                wp: "5493794000000",
                destacado: true,
                opensAt: 8, closesAt: 20
            });
        }
        
        state.lugares.forEach(l => { if(!l.opensAt) { l.opensAt = 9; l.closesAt = 22; } });
        state.lugaresFiltrados = state.lugares;
        renderMarkers(state.lugares);
        renderFeed(state.lugares);
    } catch (e) {
        console.error(e);
        showToast("⚠️ Usando datos cacheados");
    }
}

function checkConnection() {
    const banner = document.getElementById('offline-banner');
    if(!navigator.onLine) banner.classList.add('visible');
    window.addEventListener('offline', () => banner.classList.add('visible'));
    window.addEventListener('online', () => {
        banner.classList.remove('visible');
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
    
    state.markersCluster = L.markerClusterGroup({ 
        showCoverageOnHover: false, 
        maxClusterRadius: 40,
        iconCreateFunction: function(cluster) {
            return L.divIcon({ html: `<div>${cluster.getChildCount()}</div>`, className: 'custom-cluster', iconSize: [40, 40] });
        }
    });
    state.map.addLayer(state.markersCluster);
}

function updateMapTiles() {
    const isDark = document.body.classList.contains('dark-mode');
    const url = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    state.map.eachLayer(l => { if(l instanceof L.TileLayer) state.map.removeLayer(l); });
    L.tileLayer(url, { maxZoom: 19 }).addTo(state.map);
}

function renderMarkers(list) { 
    state.markersCluster.clearLayers(); 
    list.forEach(l => { 
        let iconClass = 'fa-map-marker-alt';
        let colorClass = l.categoria.split(' ')[0];
        
        if(l.categoria.includes('turismo')) iconClass = 'fa-camera';
        if(l.categoria.includes('comida') || l.categoria.includes('gastro')) iconClass = 'fa-utensils';
        if(l.categoria.includes('playa')) iconClass = 'fa-umbrella-beach';
        if(l.categoria.includes('techfix')) { iconClass = 'fa-wrench'; colorClass = 'techfix'; }

        const isTechFix = l.nombre.toLowerCase().includes('techfix');
        const customHtml = `
            <div class="pin-head ${colorClass} ${isTechFix ? 'pulse-gold' : ''}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="pin-point"></div>`;

        const icon = L.divIcon({ 
            className: `custom-pin ${isTechFix ? 'z-top' : ''}`, 
            html: customHtml, 
            iconSize:[40,50], 
            iconAnchor:[20,50] 
        }); 
        
        const marker = L.marker([l.lat,l.lng],{icon});
        marker.on('click', () => abrirFicha(l));
        state.markersCluster.addLayer(marker); 
    }); 
}

window.filtrarInput = (val) => { state.busquedaActual = val.toLowerCase(); ejecutarFiltros(); };
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
                state.userMarker = L.marker([state.userCoords.lat, state.userCoords.lng], {
                    icon: L.divIcon({className:'user-dot'})
                }).addTo(state.map);
            } else {
                state.userMarker.setLatLng([state.userCoords.lat, state.userCoords.lng]);
            }
            checkGeofence();
            actualizarBotonCheckin(); 
        }, (err) => { console.warn("GPS Warn", err); }, CONFIG.gpsOptions); 
    }
};

function checkGeofence() {
    if(!state.userCoords || state.notificadoTechFix) return;
    const dist = getDistance(state.userCoords.lat, state.userCoords.lng, CONFIG.techFixCoords[0], CONFIG.techFixCoords[1]);
    if(dist < CONFIG.radioNotificacion) {
        showToast("🔔 ¡Estás cerca de TechFix! Pasa a saludar.");
        if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
        state.notificadoTechFix = true;
    }
}

window.iniciarRuta = (destinoParam) => {
    let destinoLatLng;
    if(destinoParam === 'ficha' && state.currentPlace) {
        destinoLatLng = L.latLng(state.currentPlace.lat, state.currentPlace.lng);
        cerrarFicha();
    } else if(destinoParam === 'techfix') {
        destinoLatLng = L.latLng(CONFIG.techFixCoords);
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
    });

    cambiarTab('map');
};

window.finalizarViaje = () => {
    if(state.routingControl) {
        state.map.removeControl(state.routingControl);
        state.routingControl = null;
    }
    document.getElementById('nav-ui-bottom').classList.remove('active');
};

window.refreshFeed = () => {
    renderFeedSkeletons();
    setTimeout(() => { fetchLugares(); showToast("Datos actualizados"); }, 1000);
}

function renderFeedSkeletons() {
    const c = document.getElementById('feed-container');
    c.innerHTML = Array(4).fill('<div class="skeleton" style="height:180px; border-radius:28px;"></div>').join('');
}

function renderFeed(list) { 
    const c = document.getElementById('feed-container'); 
    if(!list || list.length === 0) { 
        c.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:20px; color:#888">No hay lugares para mostrar.</div>'; 
        return; 
    } 
    
    c.innerHTML = list.map((l, index) => { 
        const isFav = state.favoritos.includes(l.nombre); 
        const cardClass = index === 0 ? 'card-modern card-hero' : 'card-modern';
        const imgUrl = l.img || 'https://via.placeholder.com/400x400?text=Ruta+Correntina';
        
        return `
        <div class="${cardClass}" onclick="abrirFichaNombre('${l.nombre}')">
            <img src="${imgUrl}" loading="lazy" alt="${l.nombre}">
            ${l.destacado ? '<span class="card-badge-top">⭐ TOP</span>' : ''}
            <div class="card-fav-btn ${isFav?'active':''}">${isFav ? '❤️' : '🤍'}</div>
            <div class="card-overlay">
                <div class="glass-info">
                    <h3>${l.nombre}</h3>
                    <p><i class="fas fa-map-marker-alt"></i> ${l.categoria.split(' ')[0]}</p>
                </div>
            </div>
        </div>`;
    }).join(''); 
}

window.abrirFicha = (l) => {
    state.currentPlace = l;
    const isFav = state.favoritos.includes(l.nombre);
    const bgStyle = l.img ? `<img src="${l.img}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Ruta+Correntina'">` : `<div class="placeholder-gradient"><i class="fas fa-image"></i></div>`;
    
    document.getElementById('ficha-lugar').innerHTML = `
        <div class="ficha-hero">
            ${bgStyle}
            <button class="btn-back-float" onclick="cerrarFicha()"><i class="fas fa-chevron-down"></i></button>
            <button class="btn-fav-float ${isFav?'active':''}" onclick="toggleFavorite('${l.nombre}')"><i class="${isFav ? 'fas' : 'far'} fa-heart"></i></button>
        </div>
        <div class="ficha-content">
            <div class="ficha-header">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="tag-cat">${l.categoria.split(' ')[0]}</span>
                    ${l.destacado ? '<span class="tag-top">⭐ TOP</span>' : ''}
                </div>
                <h1>${l.nombre}</h1>
                <p>${l.desc || 'Explora este lugar increíble.'}</p>
            </div>
            <div class="action-grid">
                <button onclick="iniciarRuta('ficha')" class="btn-action primary"><i class="fas fa-location-arrow"></i> IR AHORA</button>
                <button onclick="compartirLugar('${l.nombre}')" class="btn-action secondary"><i class="fas fa-share-alt"></i></button>
                ${l.wp ? `<a href="https://wa.me/${l.wp}" target="_blank" class="btn-action whatsapp"><i class="fab fa-whatsapp"></i></a>` : ''}
            </div>
            <button id="btn-checkin-dynamic" onclick="triggerCheckIn()" class="btn-checkin-big disabled"><i class="fas fa-satellite-dish"></i> <span>Ubicando...</span></button>
            <input type="file" id="foto-checkin" accept="image/*" capture="environment" style="display:none" onchange="procesarFotoCheckin(this)">
            <div class="comments-section">
                <h3>Reseñas</h3>
                <div class="review-input-box"><input type="text" id="input-review" placeholder="Deja tu opinión..."><button onclick="enviarComentario()"><i class="fas fa-paper-plane"></i></button></div>
                <div id="lista-comentarios">Cargando...</div>
            </div>
        </div>`;
    
    document.getElementById('ficha-lugar').classList.add('open');
    actualizarBotonCheckin();
    cargarComentarios(l.nombre);
};

window.cerrarFicha = () => { document.getElementById('ficha-lugar').classList.remove('open'); state.currentPlace = null; };
window.destinoMagico = () => {
    const opciones = state.lugares.filter(l => !l.nombre.toLowerCase().includes('techfix'));
    const random = opciones[Math.floor(Math.random() * opciones.length)];
    if(random) { abrirFichaNombre(random.nombre); showToast(`✨ ¡El destino eligió: ${random.nombre}!`); }
};

window.abrirFichaNombre = (n) => { 
    const l = state.lugares.find(x=>x.nombre===n); 
    if(l) { cambiarTab('map'); setTimeout(()=>{ state.map.flyTo([l.lat,l.lng],16); abrirFicha(l); },300); } 
};

async function cargarPerfil(u) {
    const docRef = doc(db, "users", u.uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        const d = snap.data();
        state.visitados = d.visitados || [];
        state.favoritos = d.favoritos || [];
        
        const userName = d.nombre || u.displayName || 'Explorador';
        document.getElementById('user-name').innerText = userName;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${userName}&background=007AFF&color=fff&size=128&bold=true`;
        
        if(u.email === 'ale@techfix.com') {
            document.getElementById('badge-role').innerText = "CEO TECHFIX";
            document.getElementById('badge-role').style.background = "linear-gradient(90deg, #FFD60A, #FF9F0A)";
        }

        const xp = state.visitados.length * 100;
        const lvl = Math.floor(xp / 500) + 1;
        const pct = Math.min(100, (xp % 500) / 500 * 100);
        document.getElementById('level-badge').innerText = `Lv. ${lvl}`;
        document.getElementById('current-xp').innerText = `${xp} / ${(lvl*500)} XP`;
        document.getElementById('xp-bar-fill').style.width = `${pct}%`;
        
        const puntos = state.visitados.length * 10;
        document.getElementById('tech-points').innerText = puntos;
        document.getElementById('canje-points').innerText = puntos;

        document.getElementById('stat-visitados').innerText = state.visitados.length;
        document.getElementById('stat-badges-count').innerText = Math.floor(state.visitados.length / 3); 

        const miniGrid = document.getElementById('passport-grid-mini');
        if(miniGrid && state.visitados.length > 0) {
            const ultimas = state.visitados.slice(-3).reverse();
            miniGrid.innerHTML = ultimas.map(v => `<img src="${v.foto}">`).join('');
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
    alert("¡Muestra este mensaje en TechFix para validar tu descuento!");
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
    if(id==='map') setTimeout(()=>state.map.invalidateSize(), 200);
};

// Auth & Social
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
window.toggleFavorite = async (n) => { const idx = state.favoritos.indexOf(n); if(idx > -1) state.favoritos.splice(idx, 1); else state.favoritos.push(n); const btn = document.querySelector('.btn-fav-float i'); if(btn) btn.className = state.favoritos.includes(n) ? 'fas fa-heart' : 'far fa-heart'; if(state.currentUser) await setDoc(doc(db, "users", state.currentUser.uid), { favoritos: state.favoritos }, { merge: true }); else localStorage.setItem('localFavs', JSON.stringify(state.favoritos)); renderFeed(state.lugaresFiltrados); showToast(idx > -1 ? "💔 Eliminado" : "❤️ Favorito"); };
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

window.abrirEditarPerfil = async () => {
    const nuevoNombre = prompt("Escribe tu nuevo nombre:", document.getElementById('user-name').innerText);
    if(nuevoNombre && nuevoNombre.trim() !== "") {
        if(state.currentUser) {
            await setDoc(doc(db, "users", state.currentUser.uid), { nombre: nuevoNombre }, { merge: true });
            cargarPerfil(state.currentUser);
            showToast("✅ Perfil actualizado");
        }
    }
};

/* ==========================================
   MÓDULO IA GEMINI - TECHFIX EDITION (FINAL FIX)
   ========================================== */

const GEMINI_API_KEY = "AIzaSyAnsZwcgoTuhVcKWI0xoJ7k93B39iuX-MY"; 

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
    btn.disabled = true;
    
    const loadingId = addMessage("Conectando... 🛰️", 'bot', true);

    try {
        const infoLugares = state.lugares.slice(0, 15).map(l => l.nombre).join(', ');
        const prompt = `Eres el guía de la app "Ruta Correntina". Lugares disponibles: ${infoLugares}. Si preguntan por reparaciones o tecnología, recomienda TechFix Taller. Responde corto a: "${textoUsuario}"`;

        // URL beta recomendada para solicitudes web directas
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Detalle técnico:", data.error);
            throw new Error(data.error.message);
        }
        
        const respuestaBot = data.candidates[0].content.parts[0].text;
        removeMessage(loadingId);
        addMessage(respuestaBot, 'bot');

    } catch (error) {
        console.error("Error capturado:", error);
        removeMessage(loadingId);
        addMessage("No pude conectar. 📡 Intenta de nuevo en unos segundos.", 'bot');
    } finally {
        input.disabled = false;
        btn.disabled = false;
        input.focus();
    }
};

function addMessage(text, sender, isLoading = false) {
    const chatBody = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'user-msg' : 'bot-msg';
    
    if(sender === 'bot' && !isLoading) {
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    } else {
        div.innerText = text;
    }

    if (isLoading) {
        div.id = 'loading-msg';
        div.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pensando...';
    }

    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div.id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}