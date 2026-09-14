/* ==========================================
   SERVICIO DE RUTEO POR CALLES (OSRM) - src/map/routing/routingService.js
   Extraído de firebaseService.js (Paso 2 del plan de modularización):
   resuelve el origen del usuario, calcula la ruta contra OSRM, dibuja la
   polyline sobre el mapa y arma/gestiona la tarjeta de navegación
   turno-a-turno (con acordeón de pasos y rutas alternativas).

   Punto de entrada público: iniciarNavegacionHacia(). Todo lo demás es
   detalle interno de implementación.

   Nota: esta es la implementación de ruteo que la app realmente usa (la
   conecta wireBotonComoLlegar en firebaseService.js desde cada popup).
   src/map/routingManager.js es un segundo sistema de ruteo (Leaflet
   Routing Machine) que quedó sin ningún caller — ver CLAUDE.md.
   ========================================== */
import { state } from '../../core/store.js';
import { showToast } from '../../utils/helpers.js';

let routingLayer = null;
let routingLayerHalo = null;
let origenMarker = null;

// Estado de la navegación activa: todas las rutas alternativas encontradas,
// cuál está seleccionada, el origen usado y si el acordeón de pasos está abierto.
let rutasDisponibles = [];
let rutaSeleccionadaIndex = 0;
let origenRutaActual = null;
let pasosExpandidos = false;

// Punto de entrada público: lo llama wireBotonComoLlegar (firebaseService.js)
// cuando el usuario toca "Cómo llegar" en el popup de un lugar o evento.
export function iniciarNavegacionHacia(destinoLat, destinoLng, destinoNombre) {
    // El popup se cierra al instante y sin esto no había ninguna señal
    // visible, así que mostramos de inmediato una tarjeta con spinner
    // mientras se resuelve el origen y se consulta la ruta.
    mostrarCargandoRuta(destinoNombre);

    obtenerOrigenPreciso((origenLat, origenLng) => {
        calcularRutaPorCalles(origenLat, origenLng, destinoLat, destinoLng, destinoNombre);
    });
}

// Obtiene la ubicación del usuario para trazar la ruta. El GPS ya se rastrea en
// segundo plano (iniciarGPS -> watchPosition) desde que arranca la app, así que
// usamos ese valor cacheado en el store: es instantáneo y sigue siendo preciso
// (se actualiza como mucho cada 10s). Sólo pedimos un fix nuevo si todavía no
// tenemos ninguno, y con un timeout corto para no dejar al usuario esperando.
function obtenerOrigenPreciso(callback) {
    if (state.userCoords) {
        callback(state.userCoords.lat, state.userCoords.lng);
        return;
    }

    const usarCentroMapa = () => {
        if (!state.map) return;
        showToast("⚠️ No pudimos obtener tu GPS, usando el centro del mapa");
        const center = state.map.getCenter();
        callback(center.lat, center.lng);
    };

    if (!navigator.geolocation) {
        usarCentroMapa();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            state.userCoords = { lat: latitude, lng: longitude };
            callback(latitude, longitude);
        },
        (error) => {
            console.warn("No se pudo obtener el GPS, usando respaldo:", error);
            usarCentroMapa();
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 4000 }
    );
}

function mostrarCargandoRuta(destinoNombre) {
    let navCard = document.getElementById('google-maps-nav-card');
    if (!navCard) {
        navCard = document.createElement('div');
        navCard.id = 'google-maps-nav-card';
        navCard.className = 'navigation-card';
        document.body.appendChild(navCard);
    }
    navCard.innerHTML = `
        <div class="navigation-header">
            <div class="navigation-loading">
                <div class="mini-spinner"></div>
                <span>Buscando la mejor ruta a ${destinoNombre}...</span>
            </div>
        </div>
    `;

    ocultarUIDuranteNavegacion();
}

// La barra superior y los botones flotantes usan "display: ... !important" en su
// CSS, así que un simple element.style.display = '...' no los tapa ni los
// vuelve a mostrar (el !important de la hoja de estilos gana siempre). Usamos
// setProperty con prioridad "important" para poder pisarlo desde JS.
function ocultarUIDuranteNavegacion() {
    document.querySelector('.map-top-bar')?.style.setProperty('display', 'none', 'important');
    document.querySelector('.map-floating-actions')?.style.setProperty('display', 'none', 'important');
    document.querySelector('.chat-float-btn')?.style.setProperty('display', 'none', 'important');
    // .map-suggestion-card vive fuera de .map-top-bar (flota anclada al fondo
    // por su cuenta) y ocupa casi el mismo espacio que .navigation-card: sin
    // ocultarla, ambas quedan superpuestas de forma desprolija.
    document.querySelector('.map-suggestion-card')?.style.setProperty('display', 'none', 'important');
}

function restaurarUITrasNavegacion() {
    document.querySelector('.map-top-bar')?.style.removeProperty('display');
    document.querySelector('.map-floating-actions')?.style.removeProperty('display');
    document.querySelector('.chat-float-btn')?.style.removeProperty('display');
    document.querySelector('.map-suggestion-card')?.style.removeProperty('display');
}

async function calcularRutaPorCalles(origenLat, origenLng, destinoLat, destinoLng, destinoNombre) {
    const mapa = state.map;
    if (!mapa) return;

    if (origenLat === destinoLat && origenLng === destinoLng) {
        origenLat -= 0.002; // Desplazamiento mínimo de seguridad si las coordenadas colisionan
    }

    // Cortamos el pedido si el servidor de rutas tarda demasiado, en vez de dejar
    // al usuario esperando indefinidamente frente a una tarjeta con spinner.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        // "driving" respeta las calles reales (evita atajos en línea recta), overview=full
        // trae todos los vértices para que el trazo siga la calle con precisión, y
        // alternatives=true pide además rutas alternativas para el mismo destino.
        const url = `https://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destinoLng},${destinoLat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            rutasDisponibles = data.routes;
            rutaSeleccionadaIndex = 0;
            pasosExpandidos = false;
            origenRutaActual = { lat: origenLat, lng: origenLng };

            dibujarRutaSeleccionada(mapa, destinoNombre);
        } else {
            cerrarNavCard(mapa);
            showToast("⚠️ No pudimos encontrar una ruta hacia ese destino");
        }
    } catch (error) {
        cerrarNavCard(mapa);
        if (error.name === 'AbortError') {
            console.error("Tiempo de espera agotado calculando la ruta");
            showToast("⏱️ El servidor de rutas tardó demasiado, probá de nuevo");
        } else {
            console.error("Error al calcular la ruta por calles:", error);
            showToast("❌ Error al calcular la ruta, revisá tu conexión");
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

function cerrarNavCard(mapa) {
    const navCard = document.getElementById('google-maps-nav-card');
    if (navCard) navCard.remove();
    limpiarCapasDeRuta(mapa);
    rutasDisponibles = [];
    rutaSeleccionadaIndex = 0;
    pasosExpandidos = false;
    origenRutaActual = null;
    restaurarUITrasNavegacion();
}

function dibujarRutaSeleccionada(mapa, destinoNombre) {
    const route = rutasDisponibles[rutaSeleccionadaIndex];
    if (!route || !origenRutaActual) return;

    const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    limpiarCapasDeRuta(mapa);

    // Halo blanco debajo de la línea principal para que se lea bien sobre
    // cualquier fondo del mapa (calles, agua, zonas verdes), estilo Google Maps.
    routingLayerHalo = L.polyline(coordinates, {
        color: '#ffffff',
        weight: 11,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(mapa);

    routingLayer = L.polyline(coordinates, {
        color: '#1a73e8',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(mapa);

    const origenIcon = L.divIcon({
        className: 'route-origin-marker',
        html: '<div style="width: 16px; height: 16px; border-radius: 50%; background: #34c759; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    origenMarker = L.marker([origenRutaActual.lat, origenRutaActual.lng], { icon: origenIcon, zIndexOffset: 900 }).addTo(mapa);

    // La tarjeta de navegación vive abajo (arriba de la barra de tabs), así que
    // le damos más aire abajo; arriba alcanza con un margen chico porque la
    // barra superior queda oculta durante la navegación.
    mapa.fitBounds(routingLayer.getBounds(), { paddingTopLeft: [30, 40], paddingBottomRight: [30, 260] });

    ocultarUIDuranteNavegacion();

    renderNavCard(mapa, destinoNombre);
}

function formatDistancia(metros) {
    return metros >= 1000 ? (metros / 1000).toFixed(1) + ' km' : Math.round(metros) + ' m';
}

function formatDuracion(segundos) {
    return Math.round(segundos / 60) || 1;
}

function generarPasosHtml(route) {
    let stepsHtml = '';
    if (route.legs && route.legs[0] && route.legs[0].steps) {
        route.legs[0].steps.forEach((step) => {
            const modifier = step.maneuver.modifier || '';
            const type = step.maneuver.type || '';
            const streetName = step.name ? `en <b>${step.name}</b>` : '';

            let iconName = 'arrow-up-outline';
            let colorClass = 'blue';
            let text = `Continúa ${streetName}`;

            if (type === 'depart') {
                iconName = 'navigate-outline';
                text = `Inicia tu recorrido ${streetName}`;
            } else if (modifier.includes('right')) {
                iconName = 'return-up-forward-outline';
                text = `Gira a la derecha ${streetName}`;
            } else if (modifier.includes('left')) {
                iconName = 'return-up-back-outline';
                text = `Gira a la izquierda ${streetName}`;
            } else if (type === 'arrive') {
                iconName = 'flag-outline';
                colorClass = 'green';
                text = `Has llegado a tu destino`;
            }

            const distance = formatDistancia(step.distance);

            if (distance !== '0 m' || type === 'arrive') {
                stepsHtml += `
                    <div class="navigation-step-item">
                        <div class="step-info">
                            <div class="icon-box ${colorClass}"><ion-icon name="${iconName}"></ion-icon></div>
                            <span class="step-text">${text}</span>
                        </div>
                        <span class="step-distance">${distance}</span>
                    </div>
                `;
            }
        });
    }
    return stepsHtml;
}

// Alternativa en colectivo (red SUBE): NO hay ninguna fuente de datos real
// de líneas de colectivo de Corrientes conectada todavía — esto es contenido
// de ejemplo con la estructura final ya armada (línea, tiempo, caminata
// hasta destino), listo para reemplazar por una consulta real el día que
// exista esa fuente de datos. Se marca "(ejemplo)" en el propio texto para
// no hacerlo pasar por un dato real.
function generarAlternativaColectivoHtml() {
    return `
        <div class="transit-alternative">
            <h4 class="transit-alternative-title"><ion-icon name="bus-outline"></ion-icon> También en colectivo (ejemplo)</h4>
            <div class="transit-option-card">
                <div class="transit-line-badge">L104</div>
                <div class="transit-option-info">
                    <span class="transit-option-title">Línea 104 (SUBE)</span>
                    <span class="transit-option-meta">
                        <ion-icon name="time-outline"></ion-icon> 18 min
                        · <ion-icon name="walk-outline"></ion-icon> 4 min a pie
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderNavCard(mapa, destinoNombre) {
    const route = rutasDisponibles[rutaSeleccionadaIndex];
    const distanciaTotal = formatDistancia(route.distance);
    const duracionMinutos = formatDuracion(route.duration);

    const pillsHtml = rutasDisponibles.length > 1 ? `
        <div class="route-alt-pills">
            ${rutasDisponibles.map((r, i) => `
                <button class="route-alt-pill ${i === rutaSeleccionadaIndex ? 'active' : ''}" data-idx="${i}">
                    Ruta ${i + 1} · ${formatDuracion(r.duration)} min
                </button>
            `).join('')}
        </div>
    ` : '';

    let navCard = document.getElementById('google-maps-nav-card');
    if (!navCard) {
        navCard = document.createElement('div');
        navCard.id = 'google-maps-nav-card';
        navCard.className = 'navigation-card';
        document.body.appendChild(navCard);
    }

    navCard.innerHTML = `
        <div class="navigation-header">
            <div class="navigation-title-box">
                <h3>🧭 ${destinoNombre}</h3>
                <p>${duracionMinutos} min &middot; ${distanciaTotal}</p>
            </div>
            <button id="btn-toggle-pasos" class="btn-toggle-steps" aria-label="Ver pasos de la ruta" aria-expanded="${pasosExpandidos}">
                <ion-icon name="chevron-down-outline"></ion-icon>
            </button>
            <button id="btn-cerrar-nav" class="btn-close-navigation" aria-label="Cerrar navegación">✕</button>
        </div>
        ${pillsHtml}
        <div class="navigation-steps-wrapper ${pasosExpandidos ? 'expanded' : ''}" id="navigation-steps-wrapper">
            <div class="navigation-steps-list">
                ${generarPasosHtml(route)}
            </div>
        </div>
        ${generarAlternativaColectivoHtml()}
    `;

    document.getElementById('btn-cerrar-nav').addEventListener('click', () => cerrarNavCard(mapa));

    const btnToggle = document.getElementById('btn-toggle-pasos');
    btnToggle.addEventListener('click', () => {
        pasosExpandidos = !pasosExpandidos;
        btnToggle.setAttribute('aria-expanded', String(pasosExpandidos));
        document.getElementById('navigation-steps-wrapper').classList.toggle('expanded', pasosExpandidos);
    });

    navCard.querySelectorAll('.route-alt-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
            const idx = Number(pill.dataset.idx);
            if (idx === rutaSeleccionadaIndex) return;
            rutaSeleccionadaIndex = idx;
            dibujarRutaSeleccionada(mapa, destinoNombre);
        });
    });
}

function limpiarCapasDeRuta(mapa) {
    if (routingLayer) {
        mapa.removeLayer(routingLayer);
        routingLayer = null;
    }
    if (routingLayerHalo) {
        mapa.removeLayer(routingLayerHalo);
        routingLayerHalo = null;
    }
    if (origenMarker) {
        mapa.removeLayer(origenMarker);
        origenMarker = null;
    }
}
