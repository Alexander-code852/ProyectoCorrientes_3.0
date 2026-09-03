/* ==========================================
   RUTA CORRENTINA - ULTIMATE EDITION v12.6
   Dev: Alejandro - Arquitectura Modular
   ========================================== */
import { initPWA } from './src/utils/pwa.js';
import { db, auth, collection, doc, setDoc, addDoc, serverTimestamp, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, getDocs, query, limit, where, orderBy } from './firebase.js';
import { CONFIG } from './src/core/constants.js';
import { state } from './src/core/store.js';
import { getDistance, showToast, setupHeaderDate } from './src/utils/helpers.js';
import { initMap, updateMapTiles, renderMarkers, iniciarGPS, centrarMapaUsuario, iniciarRuta, finalizarViaje } from './src/map/mapManager.js';
import { initTheme, cambiarTab, renderFeedSkeletons, renderFeed, abrirFicha, cerrarFicha, toggleAuthUI, addMessage, removeMessage } from './src/ui/uiManager.js';
import { fetchLugares, cargarReportesComunitarios, cargarPerfil } from './src/services/firebaseService.js';
import { enviarMensajeIA } from './src/services/geminiAi.js';
import { initEventListeners } from './src/ui/events.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ---- INICIALIZACIÓN GLOBAL ----
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(e => console.log("SW Falló", e));
    checkConnection(); setupHeaderDate();
    setTimeout(() => { const s = document.getElementById('splash-screen'); if(s) { s.style.opacity = '0'; setTimeout(() => { s.remove(); if(state.map) state.map.invalidateSize(); }, 600); } }, 1500);

    initMap(); 
    initTheme();
    initEventListeners(); 
    initPWA();
    
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('resize', () => { if(state.map) setTimeout(() => state.map.invalidateSize(), 300); });
    
    onAuthStateChanged(auth, async (user) => {
        state.currentUser = user;
        if (user) {
            toggleAuthUI(true);
            const localFavsRaw = localStorage.getItem('localFavs');
            if (localFavsRaw) {
                try {
                    const localFavs = JSON.parse(localFavsRaw);
                    if (localFavs.length > 0) {
                        const mergedFavs = [...new Set([...(user.favoritos || []), ...localFavs])];
                        await setDoc(doc(db, "users", user.uid), { favoritos: mergedFavs }, { merge: true });
                        localStorage.removeItem('localFavs');
                    }
                } catch (e) {}
            }
            await cargarPerfil(user);
        } else {
            toggleAuthUI(false);
            state.favoritos = localStorage.getItem('localFavs') ? JSON.parse(localStorage.getItem('localFavs')) : [];
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
    if(dot && compass) dot.style.transform = `translate(-50%, -50%) rotate(${compass}deg)`;
}

// ---- CONEXIONES AL OBJETO WINDOW PARA HTML ----
window.showToast = showToast; window.getDistance = getDistance; window.centrarMapaUsuario = centrarMapaUsuario; window.iniciarRuta = iniciarRuta; window.finalizarViaje = finalizarViaje; window.iniciarGPS = iniciarGPS;
window.cambiarTab = cambiarTab; window.abrirFicha = abrirFicha; window.cerrarFicha = cerrarFicha; window.enviarMensajeIA = enviarMensajeIA; window.updateMapTiles = updateMapTiles;

let debounceTimer;
window.filtrarInput = (val) => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { state.busquedaActual = val.toLowerCase(); window.ejecutarFiltros(); window.mostrarSugerencias(state.busquedaActual); }, 300); };
window.mostrarSugerencias = (val) => {
    const box = document.getElementById('search-results'); if(!val) { box.classList.add('hidden'); return; }
    const sugerencias = state.lugares.filter(l => l.nombre.toLowerCase().includes(val)).slice(0, 5);
    if(sugerencias.length === 0) { box.classList.add('hidden'); return; }
    box.innerHTML = sugerencias.map(l => `<div class="search-result-item" onclick="seleccionarSugerencia('${l.nombre}')"><ion-icon name="location-outline"></ion-icon> <span>${l.nombre}</span></div>`).join('');
    box.classList.remove('hidden');
};
window.seleccionarSugerencia = (nombre) => { document.getElementById('buscador-input').value = nombre; document.getElementById('search-results').classList.add('hidden'); state.busquedaActual = nombre.toLowerCase(); window.ejecutarFiltros(); window.abrirFichaNombre(nombre); };
window.filtrarBoton = (cat, btn) => { state.filtroActual = cat.toLowerCase(); document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active')); if(btn) btn.classList.add('active'); window.ejecutarFiltros(); if(navigator.vibrate) navigator.vibrate(10); };
window.ejecutarFiltros = () => {
    const horaActual = new Date().getHours();
    state.lugaresFiltrados = state.lugares.filter(l => {
        let catMatch = true;
        if(state.filtroActual === 'abierto') catMatch = (l.opensAt <= horaActual && l.closesAt > horaActual);
        else if (state.filtroActual === 'favoritos') catMatch = state.favoritos.includes(l.nombre);
        else if (state.filtroActual !== 'todos') catMatch = JSON.stringify(l).toLowerCase().includes(state.filtroActual);
        return catMatch && (!state.busquedaActual || l.nombre.toLowerCase().includes(state.busquedaActual));
    });
    renderMarkers(state.lugaresFiltrados); renderFeed(state.lugaresFiltrados);
};
window.toggleLayerPanel = () => document.getElementById('layer-panel').classList.toggle('hidden');
window.toggleLayer = (cat, show) => { state.activeLayers[cat] = show; window.ejecutarFiltros(); };
window.abrirModalReporte = () => document.getElementById('modal-reporte').classList.add('active');
window.cerrarModalReporte = () => document.getElementById('modal-reporte').classList.remove('active');
window.enviarReporte = async () => {
    if(!state.userCoords) return showToast("⚠️ Esperando señal GPS...");
    try {
        await addDoc(collection(db, "reportes"), { tipo: document.getElementById('tipo-reporte').value, descripcion: document.getElementById('desc-reporte').value.trim(), lat: state.userCoords.lat, lng: state.userCoords.lng, fecha: serverTimestamp(), usuario: state.currentUser ? state.currentUser.displayName : 'Anónimo' });
        showToast("⚠️ ¡Incidente reportado!"); window.cerrarModalReporte(); await cargarReportesComunitarios(); renderMarkers(state.lugares);
    } catch(e) { showToast("❌ Error al enviar reporte"); }
};
window.refreshFeed = () => { renderFeedSkeletons(); setTimeout(() => { fetchLugares(); showToast("Datos actualizados"); }, 1000); };
window.activarAlertaParada = (nombre, lat, lng) => { state.alertaParadaActiva = { nombre, lat, lng }; cerrarFicha(); showToast(`🔔 Alerta activada: Te avisaremos al llegar a ${nombre}`); };
window.reproducirAudioGuia = (titulo, texto) => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`Te presentamos ${titulo}. ${texto}`); u.lang = 'es-AR'; window.speechSynthesis.speak(u); showToast("🔊 Reproduciendo audio-guía..."); } else showToast("⚠️ Tu navegador no soporta audio-guía"); };
window.filtrarPorLinea = (linea) => { cerrarFicha(); cambiarTab('map'); const filtrados = state.lugares.filter(l => l.lineas && l.lineas.includes(linea)); state.lugaresFiltrados = filtrados; renderMarkers(filtrados); showToast(`🚌 Filtrando por Línea ${linea}`); };
window.destinoMagico = () => { const opciones = state.lugares.filter(l => !l.categoria.includes('reportes')); const random = opciones[Math.floor(Math.random() * opciones.length)]; if(random) { window.abrirFichaNombre(random.nombre); showToast(`✨ ¡El destino eligió: ${random.nombre}!`); } };
window.abrirFichaNombre = (n) => { const l = state.lugares.find(x=>x.nombre===n); if(l) { cambiarTab('map'); setTimeout(()=>{ state.map.flyTo([l.lat,l.lng],16); abrirFicha(l); },300); } };
window.canjearPremio = (id) => alert("¡Muestra este mensaje en el local adherido para validar tu descuento!");
window.toggleRanking = async (show) => {
    const modal = document.getElementById('modal-ranking');
    if(show) { modal.classList.add('open'); const list = document.getElementById('ranking-list'); list.innerHTML = '<div class="skeleton" style="height:50px;margin-bottom:10px;"></div>'.repeat(3);
        try { const snap = await getDocs(query(collection(db, "users"), limit(10))); let users = []; snap.forEach(doc => { const d = doc.data(); users.push({ name: d.nombre || 'Anónimo', xp: (d.visitados?.length || 0) * 100 }); }); users.sort((a,b) => b.xp - a.xp); list.innerHTML = users.map((u, i) => `<div class="rank-item"><div class="rank-pos top-${i+1}">${i+1}</div><div class="rank-avatar"></div><div class="rank-info"><strong>${u.name}</strong><small>Explorador</small></div><div class="rank-xp">${u.xp} XP</div></div>`).join(''); } catch(e) {}
    } else modal.classList.remove('open');
};
window.toggleCanje = (show) => document.getElementById('modal-canje').classList[show ? 'add' : 'remove']('open');
window.toggleAuthMode = () => { const t = document.getElementById('auth-header-text'); const isReg = t.innerText==='Accede a tu pasaporte digital'; t.innerText=isReg?'Crea tu cuenta gratis':'Accede a tu pasaporte digital'; document.getElementById('btn-submit').innerText=isReg?'Registrarse':'Entrar'; document.getElementById('toggle-text').innerText=isReg?'¿Ya tienes cuenta?':'Crear cuenta'; };
window.handleSubmit = (e) => { e.preventDefault(); const em=document.getElementById('email-input').value; const ps=document.getElementById('pass-input').value; const isReg=document.getElementById('btn-submit').innerText==='Registrarse'; if(isReg) { createUserWithEmailAndPassword(auth,em,ps).then(c=>{ updateProfile(c.user,{displayName:'Viajero'}); setDoc(doc(db,"users",c.user.uid),{visitados:[]}); }).catch(e=>showToast("Error: " + e.message)); } else { signInWithEmailAndPassword(auth,em,ps).catch(e=> showToast("Credenciales incorrectas")); } };
window.cerrarSesion = () => signOut(auth).then(()=>window.location.reload());
window.toggleFavorite = async (n) => { const idx = state.favoritos.indexOf(n); let isFav = false; if(idx > -1) { state.favoritos.splice(idx, 1); showToast("💔 Eliminado"); } else { state.favoritos.push(n); isFav = true; showToast("❤️ Agregado"); } if(state.currentUser) await setDoc(doc(db, "users", state.currentUser.uid), { favoritos: state.favoritos }, { merge: true }); else localStorage.setItem('localFavs', JSON.stringify(state.favoritos)); document.querySelectorAll('.card-modern').forEach(card => { if(card.querySelector('h3').innerText === n) { const btn = card.querySelector('.card-fav-btn'); if(isFav) { btn.classList.add('active'); btn.querySelector('ion-icon').setAttribute('name', 'heart'); } else { btn.classList.remove('active'); btn.querySelector('ion-icon').setAttribute('name', 'heart-outline'); } } }); if (state.currentPlace && state.currentPlace.nombre === n) { const btnFicha = document.querySelector('.btn-fav-float'); if (btnFicha) { if(isFav) { btnFicha.classList.add('active'); btnFicha.querySelector('ion-icon').setAttribute('name', 'heart'); } else { btnFicha.classList.remove('active'); btnFicha.querySelector('ion-icon').setAttribute('name', 'heart-outline'); } } } };
window.compartirLugar = (n) => { if (navigator.share) navigator.share({ title: 'Ruta Correntina', text: `¡Mira: ${n}!`, url: window.location.href }).catch(console.error); else showToast("Link copiado"); };
window.triggerCheckIn = () => { const btn = document.getElementById('btn-checkin-dynamic'); if(btn.classList.contains('active')) document.getElementById('foto-checkin').click(); };
window.procesarFotoCheckin = (i) => { if(i.files[0]) { const r = new FileReader(); r.onload=(e)=>confirmarCheckIn(e.target.result); r.readAsDataURL(i.files[0]); }};
async function confirmarCheckIn(f) { state.visitados.push({ nombre: state.currentPlace.nombre, date: new Date().toISOString(), foto:f }); if(state.currentUser) await setDoc(doc(db,"users",state.currentUser.uid),{visitados:state.visitados},{merge:true}); if(navigator.vibrate) navigator.vibrate([100,50,100]); showToast(`🎉 +100 XP: ${state.currentPlace.nombre}`); window.actualizarBotonCheckin(); cargarPerfil(state.currentUser); }
window.actualizarBotonCheckin = () => { const btn = document.getElementById('btn-checkin-dynamic'); if(!btn || !state.currentPlace || !state.userCoords) return; const d = getDistance(state.userCoords.lat, state.userCoords.lng, state.currentPlace.lat, state.currentPlace.lng); if(state.visitados.some(v=>v.nombre===state.currentPlace.nombre)) { btn.className = "btn-checkin-big enabled"; btn.innerHTML="✅ VISITADO"; btn.style.background='var(--success-grad)'; } else if(d <= CONFIG.radioCheckin) { btn.className = "btn-checkin-big enabled active"; btn.innerHTML = "📸 FOTO CHECK-IN"; btn.style.background='var(--primary-grad)'; } else { btn.className = "btn-checkin-big disabled"; btn.innerHTML = `🚶 ACÉRCATE (${Math.round(d)}m)`; btn.style.background='#ccc'; } }

// --- LOGICA DE COMENTARIOS OFFLINE NATIVA ---
window.enviarComentario = async () => { 
    if(!state.currentUser) return showToast("Inicia sesión"); 
    const t = document.getElementById('input-review').value; 
    if(!t) return; 
    const reviewData = { lugar: state.currentPlace.nombre, usuario: state.currentUser.displayName || 'U', texto: t, fecha: serverTimestamp(), uid: state.currentUser.uid }; 
    try {
        await addDoc(collection(db, "reviews"), reviewData); 
        showToast("Enviado"); 
        document.getElementById('input-review').value=''; 
        window.cargarComentarios(state.currentPlace.nombre); 
    } catch(e) {
        showToast("❌ Error al guardar reseña");
    }
};

window.cargarComentarios = async(l) => { 
    const b = document.getElementById('lista-comentarios'); 
    b.innerHTML = '<div class="skeleton" style="height:30px; margin-bottom:5px;"></div>'.repeat(3); 
    try { 
        const s = await getDocs(query(collection(db, "reviews"), where("lugar","==",l), orderBy("fecha","desc"), limit(5))); 
        b.innerHTML = s.empty ? '<small>Sé el primero en comentar</small>' : ''; 
        s.forEach(d=>{b.innerHTML+=`<div class="review-item"><b>${d.data().usuario}</b>: ${d.data().texto}</div>`}); 
    } catch(e){ 
        b.innerHTML = '<small>Error al cargar reseñas.</small>'; 
    } 
};

window.abrirEditarPerfil = () => { document.getElementById('input-nuevo-nombre').value = document.getElementById('user-name').innerText; document.getElementById('modal-edit-profile').classList.add('active'); setTimeout(() => document.getElementById('input-nuevo-nombre').focus(), 100); };
window.cerrarEditarPerfil = () => { document.getElementById('modal-edit-profile').classList.remove('active'); };
window.guardarNuevoNombre = async () => { const nuevoNombre = document.getElementById('input-nuevo-nombre').value.trim(); if(nuevoNombre && nuevoNombre !== "" && state.currentUser) { await setDoc(doc(db, "users", state.currentUser.uid), { nombre: nuevoNombre }, { merge: true }); cargarPerfil(state.currentUser); showToast("✅ Perfil actualizado"); } window.cerrarEditarPerfil(); };
window.procesarNuevoAvatar = (input) => { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = async (e) => { const base64Image = e.target.result; document.getElementById('user-avatar').src = base64Image; document.getElementById('header-avatar').src = base64Image; if(state.currentUser) { try { showToast("⏳ Subiendo..."); await setDoc(doc(db, "users", state.currentUser.uid), { avatar: base64Image }, { merge: true }); showToast("✅ Avatar actualizado"); } catch (error) { showToast("❌ Error al guardar"); cargarPerfil(state.currentUser); } } }; reader.readAsDataURL(input.files[0]); } };
window.toggleChat = () => { const chat = document.getElementById('chat-widget'); if (!chat) return; if (chat.classList.contains('chat-hidden')) { chat.classList.remove('chat-hidden'); chat.classList.add('chat-visible'); setTimeout(() => document.getElementById('user-msg').focus(), 300); } else { chat.classList.remove('chat-visible'); chat.classList.add('chat-hidden'); } };
window.handleEnter = (e) => { if (e.key === 'Enter') enviarMensajeIA(); };
window.stateMapFlyTo = (lat, lng) => state.map.flyTo([lat, lng], 16);

function checkConnection() { const banner = document.getElementById('offline-banner'); if(!navigator.onLine && banner) banner.classList.add('visible'); window.addEventListener('offline', () => banner?.classList.add('visible')); window.addEventListener('online', () => { banner?.classList.remove('visible'); showToast("✅ Conexión restablecida"); }); }

async function fetchWeatherReal() { try { const lat = state.userCoords ? state.userCoords.lat : CONFIG.defaultCenter[0]; const lng = state.userCoords ? state.userCoords.lng : CONFIG.defaultCenter[1]; const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=auto`); const data = await res.json(); if(data?.current) { document.getElementById('temp-val').innerText = `${Math.round(data.current.temperature_2m)}°C`; document.querySelector('.weather-in-bar').style.display = 'flex'; } } catch (e) {} }