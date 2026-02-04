/* ==========================================
   RUTA CORRENTINA ULTIMATE - CORE V3.5 (FINAL)
   Dev: Alejandro (TechFix)
   ========================================== */

/* 1. IMPORTACIONES DE FIREBASE
   Asegúrate de que firebase.js esté en la misma carpeta */
import { 
    db, auth, collection, doc, setDoc, getDoc, onAuthStateChanged, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile 
} from './firebase.js';

/* 2. CONFIGURACIÓN GENERAL */
const CONFIG = {
    radioCheckin: 500, // metros para dar OK al check-in
    gpsOptions: { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
};

/* 3. ESTADO DE LA APP (Memoria) */
let state = {
    map: null,
    markersCluster: null,
    userMarker: null,
    routingControl: null,
    userCoords: null,
    currentPlace: null,
    currentUser: null, // Aquí se guarda el usuario conectado
    lugares: [],
    cupones: [],
    eventos: [],
    visitados: JSON.parse(localStorage.getItem('visitados_ultimate') || '[]'),
    badges: [
        { id: 'novato', nombre: 'Turista Novato', icon: '🎒', req: 1, desc: 'Tu primer check-in.' },
        { id: 'explorador', nombre: 'Explorador', icon: '🧭', req: 5, desc: 'Visitaste 5 lugares.' },
        { id: 'experto', nombre: 'Guía Local', icon: '👑', req: 10, desc: 'Visitaste 10 lugares.' },
        { id: 'techfix', nombre: 'TechFix Fan', icon: '📱', req: 0, special: true, desc: 'Usuario verificado.' }
    ]
};

// INICIAR APP CUANDO CARGUE LA PÁGINA
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    registerServiceWorker(); // PWA Offline
    initMap();
    initTheme();
    setupNetworkStatus();
    setupEventListeners();

    // --- ESCUCHADOR DE SESIÓN (LOGIN/LOGOUT) ---
    // Esto detecta automáticamente si el usuario entró o salió
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // USUARIO CONECTADO
            state.currentUser = user;
            console.log("✅ Conectado:", user.email);
            
            // Ocultar login y mostrar perfil
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('user-profile-content').style.display = 'block';
            
            // Descargar sus datos de la nube
            await cargarDatosUsuario(user);
        } else {
            // USUARIO DESCONECTADO
            state.currentUser = null;
            
            // Mostrar login y ocultar perfil
            document.getElementById('auth-container').style.display = 'flex'; // Flex para centrar
            document.getElementById('user-profile-content').style.display = 'none';
        }
    });

    // Cargar Lugares desde el archivo JSON
    try {
        const resp = await fetch('lugares.json');
        const data = await resp.json();
        
        // Pequeño delay para asegurar que el mapa cargó
        setTimeout(() => {
            state.lugares = data.lugares || [];
            state.cupones = data.cupones_disponibles || [];
            state.eventos = data.eventos || [];
            
            renderMarkers(state.lugares);
            renderFeed(state.lugares);
            renderEventBanner();
            updateStats();
            initWeather();
        }, 500);
        
    } catch (e) {
        console.warn('⚠️ Error cargando JSON o modo offline');
        showToast("Estás navegando sin conexión");
    }

    iniciarGPS();
    
    // Manejo del botón "Atrás" del celular
    window.addEventListener('popstate', (event) => {
        if (document.getElementById('ficha-lugar').classList.contains('open')) {
            cerrarFicha(false);
            return;
        }
        if (event.state && event.state.view) {
            cambiarTab(event.state.view, false);
        }
    });
    window.history.replaceState({ view: 'map' }, '');
}

// --- PWA SERVICE WORKER ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker OK'))
            .catch(err => console.error('Error SW:', err));
    }
}

/* ==========================================
   GESTIÓN DE USUARIOS (AUTH & FIRESTORE)
   ========================================== */

let isRegisterMode = false; // ¿Está en modo registro?

// 1. Cambiar visualmente entre "Iniciar Sesión" y "Crear Cuenta"
window.toggleAuthMode = () => {
    isRegisterMode = !isRegisterMode;
    
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btnSubmit = document.getElementById('btn-submit');
    const toggleText = document.getElementById('toggle-text');
    const btnToggle = document.getElementById('btn-toggle');

    if (isRegisterMode) {
        // MODO REGISTRO
        title.innerText = "Crear Cuenta";
        subtitle.innerText = "Únete a Ruta Correntina gratis.";
        btnSubmit.innerText = "Registrarse";
        btnSubmit.style.background = "#34C759"; // Verde
        toggleText.innerText = "¿Ya tienes cuenta?";
        btnToggle.innerText = "Volver a Iniciar Sesión";
    } else {
        // MODO LOGIN
        title.innerText = "Bienvenido";
        subtitle.innerText = "Inicia sesión para continuar.";
        btnSubmit.innerText = "Iniciar Sesión";
        btnSubmit.style.background = "#007AFF"; // Azul
        toggleText.innerText = "¿Es tu primera vez aquí?";
        btnToggle.innerText = "Crear una cuenta nueva";
    }
};

// 2. Manejar el envío del formulario
window.handleSubmit = (e) => {
    e.preventDefault();
    if (isRegisterMode) {
        ejecutarRegistro();
    } else {
        ejecutarLogin();
    }
};

// 3. Ejecutar Login
async function ejecutarLogin() {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        showToast("¡Bienvenido de nuevo!");
    } catch (error) {
        showToast("Error: " + error.message);
    }
}

// 4. Ejecutar Registro
async function ejecutarRegistro() {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;

    if (!email || !pass) { alert("Completa todos los campos."); return; }
    if (pass.length < 6) { alert("La contraseña debe tener 6 caracteres o más."); return; }

    try {
        // Crear usuario en Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        
        // Preguntar nombre
        const nombre = prompt("¡Cuenta creada! ¿Cómo quieres llamarte?", "Viajero");
        await updateProfile(user, { displayName: nombre });

        // Crear ficha en base de datos (Firestore)
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            nombre: nombre,
            visitados: [],
            xp: 0,
            nivel: 1
        });

        showToast("¡Todo listo! Bienvenido.");
    } catch (error) {
        alert("Error al registrar: " + error.message);
    }
}

// 5. Cargar datos del usuario desde la nube
async function cargarDatosUsuario(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Mezclar datos: Si hay datos en la nube, los usamos
            state.visitados = data.visitados || [];
            
            // Actualizar interfaz del perfil
            const nameEl = document.getElementById('user-name');
            const avEl = document.getElementById('user-avatar');
            
            if(nameEl) nameEl.innerText = data.nombre || user.displayName || 'Viajero';
            if(avEl) avEl.src = `https://ui-avatars.com/api/?name=${data.nombre || 'User'}&background=007AFF&color=fff`;
            
            updateStats();
        }
    } catch (e) {
        console.error("Error cargando perfil:", e);
    }
}

// 6. Cerrar Sesión
window.cerrarSesion = () => {
    signOut(auth).then(() => {
        showToast("Sesión cerrada.");
        state.visitados = []; // Limpiar memoria local
        updateStats();
        setTimeout(() => window.location.reload(), 500); // Recargar para limpiar todo
    });
};

/* ==========================================
   FUNCIONES DEL MAPA Y NAVEGACIÓN
   ========================================== */

function initMap() {
    state.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([-27.469, -58.830], 14);
    updateMapTiles();
    
    state.markersCluster = L.markerClusterGroup({ 
        showCoverageOnHover: false, maxClusterRadius: 40, animate: true 
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

// Filtro con espera (Debounce) para que no se trabe al escribir
let timeoutBusqueda;
window.filtrarInput = (val) => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => ejecutarFiltro(val), 300);
}

// Filtro rápido por botones
window.filtrarBoton = (categoria, boton) => {
    // Cambiar estilo de botones
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if(boton) boton.classList.add('active');
    
    ejecutarFiltro(categoria);
}

function ejecutarFiltro(criterio) {
    const txt = criterio.toLowerCase();
    
    const res = state.lugares.filter(l => 
        txt === 'todos' || 
        (l.categoria && l.categoria.toLowerCase().includes(txt)) || 
        l.nombre.toLowerCase().includes(txt) ||
        (l.tags && l.tags.some(tag => tag.includes(txt)))
    );
    
    renderMarkers(res);
    
    if(document.getElementById('view-list').style.display !== 'none') {
        renderFeed(res);
    }

    if (res.length > 0 && txt !== 'todos' && txt !== '') {
        const grupo = L.featureGroup(res.map(l => L.marker([l.lat, l.lng])));
        setTimeout(() => state.map.flyToBounds(grupo.getBounds().pad(0.2), { duration: 1.5 }), 50);
    } else if (txt === 'todos') {
        state.map.flyTo([-27.469, -58.830], 14);
    }
}

// --- CHECK-IN Y GPS ---

window.triggerCheckIn = () => {
    const btn = document.getElementById('btn-checkin-dynamic');
    if(btn.classList.contains('visited-state')) return;
    
    // Vibración
    if(navigator.vibrate) navigator.vibrate(15);
    
    if(btn.classList.contains('enabled')) { 
        document.getElementById('foto-checkin').click(); 
    } else { 
        showToast("Estás demasiado lejos."); 
    }
};

window.procesarFotoCheckin = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { confirmarCheckIn(e.target.result); }
        reader.readAsDataURL(input.files[0]);
    }
};

async function confirmarCheckIn(fotoBase64) {
    if(!state.currentPlace) return;
    
    const nuevoCheckin = { 
        nombre: state.currentPlace.nombre, 
        date: new Date().toISOString(), 
        foto: fotoBase64 
    };
    
    // Guardar en memoria local
    state.visitados.push(nuevoCheckin);
    
    // Guardar en NUBE (si está conectado)
    if (state.currentUser) {
        try {
            const userRef = doc(db, "users", state.currentUser.uid);
            await setDoc(userRef, { visitados: state.visitados }, { merge: true });
        } catch (err) {
            console.error("Error guardando en nube:", err);
        }
    }

    showToast(`🎉 ¡+50 XP! Visitaste ${state.currentPlace.nombre}`);
    actualizarBotonCheckin();
    updateStats();
}

function actualizarBotonCheckin() {
    const btn = document.getElementById('btn-checkin-dynamic');
    if(!btn || !state.currentPlace || !state.userCoords) return;
    
    const visitado = state.visitados.find(v => v.nombre === state.currentPlace.nombre);
    
    if (visitado) {
        btn.className = "btn-checkin-big visited-state";
        btn.style.background = 'var(--success-grad)';
        btn.innerHTML = `<i class="fas fa-check-circle"></i> VISITADO`;
        return;
    }
    
    const dist = getDistance(state.userCoords.lat, state.userCoords.lng, state.currentPlace.lat, state.currentPlace.lng);
    
    if (dist <= CONFIG.radioCheckin) {
        btn.className = "btn-checkin-big enabled photo-mode";
        btn.innerHTML = `📸 FOTO CHECK-IN`;
    } else {
        btn.className = "btn-checkin-big disabled";
        btn.style.background = 'rgba(142, 142, 147, 0.15)';
        btn.innerHTML = `🚶 ACÉRCATE (${Math.round(dist)}m)`;
    }
}

// --- RENDERIZADO Y UI ---

function renderMarkers(lista) {
    state.markersCluster.clearLayers();
    lista.forEach(l => {
        const catClass = l.categoria ? l.categoria.toLowerCase() : 'default';
        const icon = L.divIcon({ className: 'custom-pin', html: `<div class="pin-head ${catClass}"><i class="fas ${getCatIcon(l.categoria)}"></i></div><div class="pin-point" style="border-top-color: white"></div>`, iconSize: [40, 50], iconAnchor: [20, 50] });
        const m = L.marker([l.lat, l.lng], { icon: icon });
        m.on('click', () => abrirFicha(l));
        state.markersCluster.addLayer(m);
    });
}

function renderFeed(lista) {
    const container = document.getElementById('feed-container');
    if(!container) return;
    
    const destacados = lista.sort((a,b) => (b.estrellas || 0) - (a.estrellas || 0));
    
    container.innerHTML = destacados.map(l => {
        const tieneImagen = l.img && !l.img.includes('logo.png');
        const bgStyle = tieneImagen ? `background-image: url('${l.img}');` : `background: linear-gradient(45deg, #007AFF, #00C6FF);`; 
        const isPremium = l.estrellas === 5 ? 'premium' : '';
        
        return `
        <div class="card-explorar ${isPremium}" onclick="abrirFichaNombre('${l.nombre}')" style="${bgStyle}">
            <div class="card-content">
                <div class="card-top">
                    <span class="tag-cat">${l.categoria || 'Lugar'}</span>
                    ${l.estrellas ? `<span class="tag-star"><i class="fas fa-star"></i> ${l.estrellas}</span>` : ''}
                </div>
                <div class="card-bottom">
                    <h3>${l.nombre}</h3>
                    <p><i class="fas fa-map-marker-alt"></i> Corrientes</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

function updateStats() {
    const totalVisitados = state.visitados.length;
    const nivelActual = Math.floor(totalVisitados / 2) + 1; 
    
    const elVis = document.getElementById('stat-visitados');
    const elNiv = document.getElementById('stat-nivel');
    if(elVis) elVis.innerText = totalVisitados;
    if(elNiv) elNiv.innerText = nivelActual;

    // Badges (Insignias)
    const badgeContainer = document.getElementById('badges-container');
    if (badgeContainer) {
        let badgesHTML = '';
        state.badges.forEach(b => {
            const unlocked = totalVisitados >= b.req || b.special;
            badgesHTML += `
            <div class="badge-item ${unlocked ? 'unlocked' : 'locked'}" onclick="showBadgeInfo('${b.nombre}', '${b.desc}')">
                <div class="badge-icon">${b.icon}</div>
                <span>${b.nombre}</span>
            </div>`;
        });
        badgeContainer.innerHTML = badgesHTML;
    }
    
    // Pasaporte
    const pasaporteGrid = document.getElementById('pasaporte-grid');
    if (pasaporteGrid) {
        const fotos = state.visitados.filter(v => v.foto);
        if (fotos.length > 0) { 
            pasaporteGrid.innerHTML = fotos.map(v => {
                const rot = Math.floor(Math.random() * 16) - 8; 
                return `<div class="foto-recuerdo" style="--rot:${rot}deg"><img src="${v.foto}" loading="lazy"><span>${v.nombre}</span></div>`;
            }).join(''); 
        } else if (state.visitados.length > 0) { 
            pasaporteGrid.innerHTML = '<div class="empty-state-p">Has visitado lugares, pero sin fotos aún.</div>'; 
        }
    }
}

// --- UTILIDADES ---

window.abrirFichaNombre = (n) => { const l = state.lugares.find(x=>x.nombre===n); if(l) { cambiarTab('map', false); setTimeout(() => { state.map.flyTo([l.lat, l.lng], 16); abrirFicha(l); }, 300); } };

window.cambiarTab = (tabId, pushHistory = true) => {
    if (document.getElementById('ficha-lugar').classList.contains('open')) cerrarFicha(false);
    
    // Animación de cambio de pestaña
    document.querySelectorAll('.app-view').forEach(v => { 
        v.classList.remove('active'); 
        setTimeout(() => { if(!v.classList.contains('active')) v.style.display = 'none'; }, 200); 
    });
    
    const target = document.getElementById(`view-${tabId}`);
    target.style.display = 'block';
    setTimeout(() => { target.style.opacity = '1'; target.classList.add('active'); }, 50);
    
    // Botones de abajo
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const mapIdx = {'map':0, 'list':1, 'profile':2};
    document.querySelectorAll('.tab-btn')[mapIdx[tabId]].classList.add('active');
    
    if(tabId === 'map') setTimeout(() => state.map.invalidateSize(), 250);
    if(tabId === 'profile') updateStats();
    if (pushHistory) window.history.pushState({ view: tabId }, '', `?view=${tabId}`);
};

window.iniciarGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition((pos) => {
            state.userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const icon = L.divIcon({ className: '', html: '<div class="user-dot"></div><div class="user-pulse"></div>', iconSize: [20, 20] });
            if (!state.userMarker) state.userMarker = L.marker([state.userCoords.lat, state.userCoords.lng], { icon: icon }).addTo(state.map);
            else state.userMarker.setLatLng([state.userCoords.lat, state.userCoords.lng]);
            actualizarBotonCheckin();
    }, null, CONFIG.gpsOptions);
};

window.abrirFicha = (lugar) => {
    state.currentPlace = lugar;
    const isFav = (state.favoritos || []).includes(lugar.nombre);
    const tieneImagen = lugar.img && !lugar.img.includes('logo.png');
    const imgStyle = tieneImagen ? `<img src="${lugar.img}" loading="lazy">` : `<div style="width:100%; height:100%; background: linear-gradient(45deg, #007AFF, #00C6FF); display:flex; align-items:center; justify-content:center;"><i class="fas ${getCatIcon(lugar.categoria)}" style="font-size:4rem; color:white; opacity:0.5;"></i></div>`;

    const html = `
        <div class="ficha-hero">
            ${imgStyle}
            <button class="btn-back-float" onclick="cerrarFicha()"><i class="fas fa-times"></i></button>
        </div>
        <div class="ficha-content">
            <div class="ficha-header">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div><span class="cat-pill-mini">${lugar.categoria||'General'}</span><h1>${lugar.nombre}</h1></div>
                    <button class="btn-fav ${isFav?'active':''}" onclick="toggleFav('${lugar.nombre}', this)" style="font-size:1.5rem; background:none; border:none; padding:0;"><i class="${isFav?'fas':'far'} fa-heart" style="color: ${isFav?'#FF3B30':'var(--text-sec)'}"></i></button>
                </div>
                <p>${lugar.desc || 'Descripción no disponible.'}</p>
            </div>
            <button id="btn-checkin-dynamic" onclick="triggerCheckIn()" class="btn-checkin-big disabled"><i class="fas fa-satellite-dish"></i> Buscando ubicación...</button>
        </div>`;
    const ficha = document.getElementById('ficha-lugar');
    ficha.innerHTML = html;
    ficha.classList.add('open');
    actualizarBotonCheckin();
};

window.cerrarFicha = (goBack = true) => { document.getElementById('ficha-lugar').classList.remove('open'); state.currentPlace = null; if (goBack && window.history.state && window.history.state.modal === 'ficha') { window.history.back(); } };
window.centrarMapaUsuario = () => { if(state.userCoords) state.map.flyTo([state.userCoords.lat, state.userCoords.lng], 16); else showToast("Buscando señal GPS..."); };
window.showBadgeInfo = (nombre, desc) => { showToast(`🏆 ${nombre}: ${desc}`); }

function setupNetworkStatus() {
    const update = () => {
        const banner = document.getElementById('offline-banner');
        if (navigator.onLine) banner.classList.remove('visible');
        else banner.classList.add('visible');
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

function renderEventBanner() {
    const container = document.getElementById('eventos-banner-container');
    if (state.eventos && state.eventos.length > 0) {
        const evt = state.eventos[0];
        container.innerHTML = `<div class="event-banner"><h4>📅 Próximo Evento</h4><h2>${evt.titulo}</h2><p>${evt.desc} • ${evt.fecha}</p></div>`;
    }
}

async function initWeather() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-27.469&longitude=-58.830&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        const widget = document.getElementById('weather-widget');
        if(widget) {
            widget.querySelector('span').innerText = `${temp}°C`;
            widget.style.display = 'inline-flex';
        }
    } catch (e) { console.warn("Clima no disponible"); }
}

function setupEventListeners() { document.getElementById('dark-mode-toggle').addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode')?'dark':'light'); updateMapTiles(); }); }
function initTheme() { if(localStorage.getItem('theme')==='dark') document.body.classList.add('dark-mode'); }
function showToast(m) { const t=document.createElement('div'); t.className='toast'; t.innerText=m; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(),3000); }
function getCatIcon(c) { return {'turismo':'fa-camera','gastronomia':'fa-utensils','hospedaje':'fa-bed','shopping':'fa-shopping-bag'}[c?.toLowerCase()] || 'fa-map-marker-alt'; }
function getDistance(lat1,lon1,lat2,lon2) { const R=6371e3; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }