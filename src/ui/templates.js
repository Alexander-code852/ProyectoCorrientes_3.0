/* ==========================================
   PLANTILLAS UI - src/ui/templates.js
   ========================================== */
import { escapeHTML } from '../utils/helpers.js';

// userData debe ser la fusión de state.currentUser (Auth: displayName/email) con
// state.userProfile (Firestore: nombre/avatar/visitados) — este último es el que
// tiene los datos que el usuario realmente edita, así que sus campos ganan.
export function getProfileTemplate(userData) {
    // userInitial usa el nombre SIN escapar (charAt no le importan las
    // entidades); userName ya escapado es lo que se manda al HTML de abajo,
    // en texto Y en el atributo value="" del input de editar nombre — ese
    // segundo caso es el más peligroso de los dos (un nombre con comillas
    // puede cerrar el atributo e inyectar HTML si no se escapa).
    const userNameCrudo = userData?.nombre || userData?.displayName || userData?.email?.split('@')[0] || 'Usuario';
    const userInitial = userNameCrudo.charAt(0).toUpperCase();
    const userName = escapeHTML(userNameCrudo);
    const userEmail = escapeHTML(userData?.email || '');
    const avatarUrl = userData?.avatar || '';

    const visitadosCount = userData?.visitados?.length || 0;
    const favoritosCount = userData?.favoritos?.length || 0;
    // Nivel derivado de lugares visitados (real), no un número fijo igual para todos.
    const nivel = 1 + Math.floor(visitadosCount / 5);

    const avatarStyle = avatarUrl
        ? `background-image:url('${avatarUrl}'); background-size:cover; background-position:center; color:transparent;`
        : '';

    // Resumen de actividad: agregar un tercer/cuarto stat (ej. "Reseñas",
    // "Puntos") es sumar un objeto acá — el markup de abajo no cambia.
    const stats = [
        { icon: 'footsteps-outline', value: visitadosCount, label: 'Visitados' },
        { icon: 'heart-outline', value: favoritosCount, label: 'Favoritos' },
    ];
    const statsHtml = stats.map((stat, i) => `
                        ${i > 0 ? '<div class="stat-divider"></div>' : ''}
                        <div class="stat-card">
                            <ion-icon name="${stat.icon}" class="stat-icon"></ion-icon>
                            <span class="stat-number">${stat.value}</span>
                            <span class="stat-label">${stat.label}</span>
                        </div>`).join('');

    return `
        <div class="profile-page-wrapper">
            <div class="profile-container">

                <!-- Columna/tarjeta de identidad: avatar + nombre + nivel +
                     resumen de actividad, todo en un mismo bloque visual en
                     vez de piezas sueltas. -->
                <section class="profile-hero">
                    <div class="profile-header">
                        <div class="avatar-wrapper">
                            <div class="avatar" id="user-avatar" style="${avatarStyle}">${avatarUrl ? '' : userInitial}</div>
                            <label class="avatar-edit-badge" title="Cambiar foto de perfil">
                                <ion-icon name="camera"></ion-icon>
                                <input type="file" id="avatar-input" accept="image/*" style="display: none;">
                            </label>
                        </div>
                        <h2 class="profile-name" id="user-name">${userName}</h2>
                        ${userEmail ? `<p class="profile-email">${userEmail}</p>` : ''}
                        <span class="profile-badge"><ion-icon name="star" class="badge-star"></ion-icon> Nivel ${nivel}</span>
                    </div>

                    <div class="profile-stats-row">${statsHtml}
                    </div>
                </section>

                <!-- Columna/lista de menú de opciones -->
                <div class="profile-menu">
                    <!-- Opciones Principales -->
                    <div class="menu-group">
                        <button class="menu-item" id="btn-edit-profile-modal">
                            <div class="icon-box blue"><ion-icon name="person-outline"></ion-icon></div>
                            <span class="menu-text">Editar Perfil</span>
                            <ion-icon name="chevron-forward-outline" class="arrow"></ion-icon>
                        </button>
                    </div>

                    <!-- Preferencias del Sistema -->
                    <div class="menu-group">
                        <div class="menu-item" id="btn-toggle-dark" style="cursor: pointer;">
                            <div class="icon-box purple"><ion-icon name="moon-outline"></ion-icon></div>
                            <span class="menu-text">Modo Oscuro</span>
                            <div class="ios-switch ${document.body.classList.contains('dark-mode') ? 'on' : ''}" id="dark-mode-switch">
                                <div class="ios-switch-knob"></div>
                            </div>
                        </div>
                        <button class="menu-item" id="btn-install-app">
                            <div class="icon-box green"><ion-icon name="cloud-download-outline"></ion-icon></div>
                            <span class="menu-text">Instalar App</span>
                            <span class="badge-free">GRATIS</span>
                        </button>
                    </div>

                    <!-- Cerrar Sesión -->
                    <div class="menu-group">
                        <button class="menu-item logout" id="btn-logout">
                            <div class="icon-box red"><ion-icon name="log-out-outline"></ion-icon></div>
                            <span class="menu-text">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal Oculto para Editar Nombre -->
        <div id="modal-edit-profile" class="modal-overlay">
            <div class="modal-card edit-profile-card">
                <h3>Editar Nombre</h3>
                <input type="text" id="input-nuevo-nombre" value="${userName}">
                <div class="modal-actions">
                    <button class="ios-btn-secondary" id="btn-cancelar-editar-perfil">Cancelar</button>
                    <button class="ios-btn-primary" id="btn-guardar-editar-perfil">Guardar</button>
                </div>
            </div>
        </div>
    `;
}