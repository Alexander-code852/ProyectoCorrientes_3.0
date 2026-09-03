// src/services/firebaseService.js
import { db, auth, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, limit, serverTimestamp, getDocs, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from '../config/firebase.js';
import { state } from '../core/store.js';
import { flattenLugares, showToast } from '../utils/helpers.js';
import { renderFeed, renderCoupons } from '../ui/uiManager.js';
import { renderMarkers } from '../map/mapManager.js';

export async function fetchLugares() {
    try {
        const resp = await fetch('lugares.json');
        const data = await resp.json();
        state.lugares = flattenLugares(data);
        state.lugares.forEach(l => { if(!l.opensAt) { l.opensAt = 9; l.closesAt = 22; } });
        state.lugaresFiltrados = state.lugares;
        renderMarkers(state.lugares);
        renderFeed(state.lugares);
    } catch (e) { showToast("⚠️ Usando datos cacheados"); }
}

export async function cargarReportesComunitarios() {
    try {
        const querySnapshot = await getDocs(collection(db, "reportes"));
        state.reportes = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            state.reportes.push({
                nombre: data.tipo, categoria: "reportes", lat: data.lat, lng: data.lng,
                desc: data.descripcion || "Incidente reportado.", img: null, opensAt: 0, closesAt: 24
            });
        });
        state.lugares = [...state.lugares, ...state.reportes];
    } catch(e) { console.warn("No se pudieron cargar reportes", e); }
}

export async function cargarPerfil(u) {
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) {
        const d = snap.data();
        state.visitados = d.visitados || []; state.favoritos = d.favoritos || [];
        const userName = d.nombre || u.displayName || 'Explorador';
        const userAvatarUrl = d.avatar || `https://ui-avatars.com/api/?name=${userName}&background=007AFF&color=fff&size=128&bold=true`;
        
        document.getElementById('user-name').innerText = userName; document.getElementById('user-avatar').src = userAvatarUrl; document.getElementById('header-avatar').src = userAvatarUrl;

        const xp = state.visitados.length * 100; const lvl = Math.floor(xp / 500) + 1;
        const maxXP = lvl * 500; const currentLvlXP = xp % 500; const pct = Math.min(100, (currentLvlXP / 500) * 100);
        let rolStr = "Turista Local"; let rolColor = "rgba(0,0,0,0.05)";
        if(lvl >= 2) { rolStr = "Aventurero"; rolColor = "rgba(0, 122, 255, 0.15); color: #007AFF;"; }
        if(lvl >= 5) { rolStr = "Guía Local"; rolColor = "rgba(52, 199, 89, 0.15); color: #34C759;"; }
        if(lvl >= 10) { rolStr = "Maestro Correntino"; rolColor = "linear-gradient(90deg, #FFD60A, #FF9F0A); color: black;"; }

        document.getElementById('level-badge').innerText = `Lv. ${lvl}`;
        document.getElementById('badge-role').innerHTML = rolStr; document.getElementById('badge-role').style = `background: ${rolColor}`;
        document.getElementById('current-xp').innerText = `${xp} / ${maxXP} XP`;
        
        const barFill = document.getElementById('xp-bar-fill'); barFill.style.width = '0%'; setTimeout(() => { barFill.style.width = `${pct}%`; }, 300);
        const puntos = state.visitados.length * 10;
        document.getElementById('tech-points').innerText = puntos.toLocaleString('es-AR'); document.getElementById('canje-points').innerText = puntos.toLocaleString('es-AR');
        if (document.getElementById('wallet-user-name')) document.getElementById('wallet-user-name').innerText = userName;
        document.getElementById('stat-visitados').innerText = state.visitados.length; document.getElementById('stat-badges-count').innerText = Math.floor(state.visitados.length / 3); 

        const miniGrid = document.getElementById('passport-grid-mini');
        if(state.visitados && state.visitados.length > 0) {
            miniGrid.innerHTML = state.visitados.slice(-10).reverse().map(v => `<img src="${v.foto}" title="${v.nombre}" loading="lazy">`).join('');
        } else {
            miniGrid.innerHTML = `<div class="album-empty-state"><ion-icon name="images-outline"></ion-icon><p>Tus fotos de check-in aparecerán aquí.</p><button onclick="cambiarTab('list')">Explorar lugares</button></div>`;
        }
        renderCoupons(puntos);
    }
}