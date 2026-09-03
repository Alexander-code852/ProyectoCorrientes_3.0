// src/utils/pwa.js

let deferredPrompt;

export function initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Evita que Chrome muestre el mini-cartel por defecto
        e.preventDefault();
        // Guarda el evento para dispararlo cuando queramos
        deferredPrompt = e;
        mostrarBotonInstalar();
    });
}

function mostrarBotonInstalar() {
    // Buscamos el grupo de configuración en el perfil
    const settingsGroup = document.querySelector('.ios-list-group:last-of-type');
    if (!settingsGroup || document.getElementById('btn-install-pwa')) return;

    // Creamos el botón de instalación con el diseño iOS de tu app
    const installBtnHTML = `
        <div class="ios-list-item" id="btn-install-pwa" role="button" style="background: rgba(52, 199, 89, 0.1);">
            <div class="list-left">
                <div class="ios-icon" style="background: #34C759;"><ion-icon name="download"></ion-icon></div> 
                Instalar App
            </div>
            <div class="list-right"><span style="color: #34C759; font-weight: bold;">GRATIS</span></div>
        </div>
    `;
    
    // Lo inyectamos al principio de la lista de configuración
    settingsGroup.insertAdjacentHTML('afterbegin', installBtnHTML);

    // Activamos el evento de instalación
    document.getElementById('btn-install-pwa').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                document.getElementById('btn-install-pwa').remove();
            }
            deferredPrompt = null;
        }
    });
}