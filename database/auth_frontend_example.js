// ============================================================
// RUTA CORRENTINA — Ejemplo de protección de UI por verificación
// ============================================================
// Referencia de diseño, NO está enganchado al src/ real: la app hoy
// usa Firebase Auth (ver src/ui/authUI.js), que verifica por enlace
// nativo en vez de un token propio (ver database/auth.py). Si algún
// día se migra a la capa SQL de database/schema.sql, este es el
// patrón para adaptar src/core/store.js y src/ui/events.js.
//
// El bloqueo acá es solo UX: la protección real vive en el backend
// (decorador requiere_verificacion de database/auth.py). Nunca confiar
// solo en esto para restringir el acceso.

// --- src/core/store.js (extensión) ---------------------------------
export const state = {
    usuario: null, // { id, email, verificado } | null tras el login
    // ...resto del state existente (map, lugares, favoritos, visitados, etc.)
};

export function puedeUsarFuncionesPrivadas() {
    return !!state.usuario && state.usuario.verificado === true;
}

// --- Marcado de botones privados en templates.js / index.html ------
// <button data-accion="toggle-favorito" data-requiere-verificacion="true">
//     <ion-icon name="heart-outline"></ion-icon>
// </button>

// --- src/ui/events.js (patrón ya usado: listener delegado en document) ---
document.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-requiere-verificacion]');
    if (boton && !puedeUsarFuncionesPrivadas()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        mostrarToast(
            state.usuario
                ? 'Verificá tu email para usar esta función ✉️'
                : 'Iniciá sesión para usar esta función'
        );
        abrirAuthOVerificacion();
        return;
    }
    // ...resto del manejo delegado ya existente
});

// --- Pista visual (opcional, junto al render de cada vista) --------
// Alternar esta clase cada vez que cambie state.usuario (login, logout,
// verificación completada):
//
// document.querySelectorAll('[data-requiere-verificacion]').forEach(el => {
//     el.classList.toggle('bloqueado', !puedeUsarFuncionesPrivadas());
// });
//
// CSS:
// [data-requiere-verificacion].bloqueado {
//     opacity: 0.5;
//     cursor: not-allowed;
// }
