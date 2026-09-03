// src/ui/events.js
export function initEventListeners() {
    // Menú Inferior (Tabs)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => window.cambiarTab(e.currentTarget.dataset.tab));
    });

    // Buscador
    document.getElementById('buscador-input')?.addEventListener('keyup', (e) => window.filtrarInput(e.target.value));

    // Filtros de píldora
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', (e) => window.filtrarBoton(e.currentTarget.dataset.filter, e.currentTarget));
    });

    // Botones del mapa
    document.getElementById('btn-center-map')?.addEventListener('click', () => window.centrarMapaUsuario());
    document.getElementById('btn-toggle-layers')?.addEventListener('click', () => window.toggleLayerPanel());
    document.getElementById('btn-close-layers')?.addEventListener('click', () => window.toggleLayerPanel());
    document.getElementById('btn-report-incident')?.addEventListener('click', () => window.abrirModalReporte());

    // Checkboxes del panel de capas
    document.querySelectorAll('.layer-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => window.toggleLayer(e.target.dataset.layer, e.target.checked));
    });

    // Navegación GPS
    document.getElementById('btn-end-trip')?.addEventListener('click', () => window.finalizarViaje());

    // Explorar / Magia / Rutas Rápidas
    document.getElementById('badge-profile-tab')?.addEventListener('click', () => window.cambiarTab('profile'));
    document.getElementById('btn-magic-dest')?.addEventListener('click', () => window.destinoMagico());
    document.getElementById('btn-see-all')?.addEventListener('click', () => window.filtrarBoton('todos', null));
    document.getElementById('btn-route-history')?.addEventListener('click', () => window.iniciarRuta('historica'));
    document.getElementById('btn-route-coast')?.addEventListener('click', () => window.iniciarRuta('costanera'));
    document.getElementById('btn-route-food')?.addEventListener('click', () => window.filtrarBoton('gastronomia', null));
    document.getElementById('btn-refresh-feed')?.addEventListener('click', () => window.refreshFeed());

    // Identificación y Perfil
    document.getElementById('auth-form')?.addEventListener('submit', (e) => window.handleSubmit(e));
    document.getElementById('toggle-text')?.addEventListener('click', () => window.toggleAuthMode());
    document.getElementById('avatar-container-click')?.addEventListener('click', () => document.getElementById('input-avatar').click());
    document.getElementById('input-avatar')?.addEventListener('change', (e) => window.procesarNuevoAvatar(e.target));
    document.getElementById('stat-visited')?.addEventListener('click', () => window.cambiarTab('list'));
    document.getElementById('stat-ranking')?.addEventListener('click', () => window.toggleRanking(true));
    document.getElementById('wallet-card')?.addEventListener('click', () => window.toggleCanje(true));
    document.getElementById('btn-edit-profile')?.addEventListener('click', () => window.abrirEditarPerfil());
    document.getElementById('btn-logout')?.addEventListener('click', () => window.cerrarSesion());

    // Modales (Reportes, Editar, Ranking)
    document.getElementById('btn-cancel-report')?.addEventListener('click', () => window.cerrarModalReporte());
    document.getElementById('btn-confirm-report')?.addEventListener('click', () => window.enviarReporte());
    document.getElementById('btn-cancel-edit-profile')?.addEventListener('click', () => window.cerrarEditarPerfil());
    document.getElementById('btn-confirm-edit-profile')?.addEventListener('click', () => window.guardarNuevoNombre());
    document.getElementById('btn-close-ranking')?.addEventListener('click', () => window.toggleRanking(false));
    document.getElementById('btn-close-canje')?.addEventListener('click', () => window.toggleCanje(false));

    // Chatbot (IA)
    document.getElementById('btn-close-chat')?.addEventListener('click', () => window.toggleChat());
    document.getElementById('btn-open-chat')?.addEventListener('click', () => window.toggleChat());
    document.getElementById('btn-send-ai')?.addEventListener('click', () => window.enviarMensajeIA());
    document.getElementById('user-msg')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.enviarMensajeIA(); });

    // Delegación de Eventos (Para contenido que se renderiza después, como Fichas y Tarjetas)
    document.addEventListener('click', (e) => {
        const searchItem = e.target.closest('.search-result-item');
        if(searchItem) window.seleccionarSugerencia(searchItem.querySelector('span').innerText);

        const feedCard = e.target.closest('.feed-card');
        const favBtn = e.target.closest('.card-fav-btn');
        if (favBtn) { e.stopPropagation(); window.toggleFavorite(favBtn.dataset.nombre); } 
        else if (feedCard) { window.abrirFichaNombre(feedCard.dataset.nombre); }

        const viewMapBtn = e.target.closest('.btn-view-map');
        if(viewMapBtn) { e.stopPropagation(); window.cambiarTab('map'); setTimeout(() => window.stateMapFlyTo(parseFloat(viewMapBtn.dataset.lat), parseFloat(viewMapBtn.dataset.lng)), 300); }

        if(e.target.closest('.btn-close-ficha')) window.cerrarFicha();
        if(e.target.closest('.btn-fav-float')) window.toggleFavorite(e.target.closest('.btn-fav-float').dataset.nombre);
        if(e.target.closest('.btn-iniciar-ruta-ficha')) window.iniciarRuta('ficha');
        if(e.target.closest('.btn-compartir-ficha')) window.compartirLugar(e.target.closest('.btn-compartir-ficha').dataset.nombre);
        if(e.target.closest('.btn-alerta-parada')) window.activarAlertaParada(e.target.closest('.btn-alerta-parada').dataset.nombre, parseFloat(e.target.closest('.btn-alerta-parada').dataset.lat), parseFloat(e.target.closest('.btn-alerta-parada').dataset.lng));
        if(e.target.closest('.btn-filtrar-linea')) window.filtrarPorLinea(e.target.closest('.btn-filtrar-linea').dataset.linea);
        if(e.target.closest('.btn-audio-guia')) window.reproducirAudioGuia(e.target.closest('.btn-audio-guia').dataset.titulo, e.target.closest('.btn-audio-guia').dataset.texto);
        
        if(e.target.closest('#btn-checkin-dynamic')) window.triggerCheckIn();
        if(e.target.closest('#btn-send-review')) window.enviarComentario();
        if(e.target.closest('.coupon-btn')) window.canjearPremio(e.target.closest('.coupon-btn').dataset.id);
    });

    document.addEventListener('change', (e) => {
        if(e.target.id === 'foto-checkin') window.procesarFotoCheckin(e.target);
    });
}