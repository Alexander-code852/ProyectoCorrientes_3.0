/* ==========================================
   LÓGICA DE AUTENTICACIÓN VISUAL Y FIREBASE - src/ui/authUI.js
   Maneja los 3 estados del modal (login/registro/verificación, ver
   index.html #auth-card) y el submit de cada form.

   Nota sobre la verificación: Firebase Auth no soporta un código numérico
   propio (4-6 dígitos) tipeado a mano — eso requeriría backend propio
   (Cloud Function que genere el código, lo guarde con expiración en
   Firestore y lo mande por un servicio de email), que hoy no existe en
   este repo (ver CLAUDE.md: la carpeta functions/ no está creada). En su
   lugar, la "fricción positiva" pedida (no dejar crear cuentas al toque)
   se logra con la verificación nativa de Firebase: sendEmailVerification()
   manda un enlace, y emailVerified confirma si ya se hizo clic en él. El
   estado "verify" del modal refleja eso (mensaje + reenviar + "ya
   verifiqué"), no un input de código.
   ========================================== */
import { auth, db } from '../config/firebase.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from '../utils/helpers.js';
import { state } from '../core/store.js';
import { initMap } from '../map/mapManager.js';

// Usuario recién registrado (o que intentó entrar sin verificar) mientras
// el modal está en el estado "verify" — se resuelve en cuanto entra a la
// app o cancela, así que alcanza con una variable de módulo.
let pendingUser = null;

// Firebase banea temporalmente (auth/too-many-requests) si se pide
// sendEmailVerification demasiadas veces seguidas para la misma cuenta.
// Este cooldown es compartido entre el reenvío automático (al intentar
// entrar sin verificar) y el botón "Reenviar correo": así un usuario que
// hace ambas cosas no dispara dos envíos casi simultáneos y agota el límite.
const RESEND_COOLDOWN_MS = 45000;
let lastVerificationSentAt = 0;

async function enviarVerificacionConCooldown(user) {
    const ahora = Date.now();
    if (ahora - lastVerificationSentAt < RESEND_COOLDOWN_MS) return false;
    lastVerificationSentAt = ahora;
    await sendEmailVerification(user);
    return true;
}

export function initAuthUI() {
    const authCard = document.getElementById('auth-card');
    const authContainer = document.getElementById('auth-container');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formReset = document.getElementById('form-reset');
    const btnCheckVerified = document.getElementById('btn-check-verified');
    const btnResend = document.getElementById('btn-resend-verification');

    if (!authCard) return;

    authCard.querySelectorAll('[data-goto]').forEach((el) => {
        el.addEventListener('click', () => showView(el.dataset.goto));
    });

    if (formLogin) formLogin.addEventListener('submit', handleLogin);
    if (formRegister) formRegister.addEventListener('submit', handleRegister);
    if (formReset) formReset.addEventListener('submit', handleReset);
    if (btnCheckVerified) btnCheckVerified.addEventListener('click', handleCheckVerified);
    if (btnResend) btnResend.addEventListener('click', handleResend);

    function showView(name) {
        authCard.querySelectorAll('.auth-view').forEach((v) => {
            v.classList.toggle('active', v.dataset.view === name);
        });
    }

    async function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        const btn = formLogin.querySelector('button');
        setLoading(btn, true, 'Entrar');

        try {
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            if (!cred.user.emailVerified) {
                pendingUser = cred.user;
                document.getElementById('verify-email-target').textContent = email;
                // Respeta el cooldown compartido: si ya se le mandó un enlace
                // hace poco (al registrarse, o en un intento de login anterior)
                // no se reenvía de nuevo — evita el auth/too-many-requests.
                const reenviado = await enviarVerificacionConCooldown(cred.user).catch(() => false);
                if (reenviado) iniciarCooldownVisual(btnResend);
                await signOut(auth); // no lo dejamos usar la app sin verificar
                showToast(reenviado
                    ? "📩 Verificá tu correo antes de entrar. Te reenviamos el enlace."
                    : "📩 Verificá tu correo antes de entrar. Ya te habíamos mandado un enlace hace un rato — revisá spam.");
                showView('verify');
                return;
            }
            enterApp();
        } catch (error) {
            showToast("❌ " + mapAuthError(error));
        } finally {
            setLoading(btn, false, 'Entrar');
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('register-email').value.trim();
        const pass = document.getElementById('register-pass').value.trim();
        const passConfirm = document.getElementById('register-pass-confirm').value.trim();

        const errorPassword = validarPassword(pass);
        if (errorPassword) { showToast("❌ " + errorPassword); return; }
        if (pass !== passConfirm) { showToast("❌ Las contraseñas no coinciden."); return; }

        const btn = formRegister.querySelector('button');
        const originalText = btn.textContent;
        setLoading(btn, true, originalText);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(cred.user, { displayName: 'Viajero' });
            await setDoc(doc(db, "users", cred.user.uid), { visitados: [] });
            // Si el envío del correo falla (ej. rate limit), no bloqueamos el
            // registro: la cuenta ya existe, el usuario puede pedir el reenvío
            // desde la pantalla de verificación en cuanto pase el cooldown.
            const enviado = await enviarVerificacionConCooldown(cred.user).catch(() => false);
            if (enviado) iniciarCooldownVisual(btnResend);

            pendingUser = cred.user;
            document.getElementById('verify-email-target').textContent = email;
            showView('verify');
        } catch (error) {
            showToast("❌ " + mapAuthError(error));
        } finally {
            setLoading(btn, false, originalText);
        }
    }

    async function handleReset(e) {
        e.preventDefault();
        const email = document.getElementById('reset-email').value.trim();
        const btn = formReset.querySelector('button');
        const originalText = btn.textContent;
        setLoading(btn, true, originalText);

        try {
            await sendPasswordResetEmail(auth, email);
            showToast("📩 Si el correo existe, te enviamos un enlace para restablecer tu contraseña.");
            showView('login');
        } catch (error) {
            showToast("❌ " + mapAuthError(error));
        } finally {
            setLoading(btn, false, originalText);
        }
    }

    async function handleCheckVerified() {
        const user = pendingUser || auth.currentUser;
        if (!user) { showView('login'); return; }

        setLoading(btnCheckVerified, true, 'Ya verifiqué, continuar');
        try {
            await user.reload();
            if (user.emailVerified) {
                enterApp();
            } else {
                showToast("Todavía no detectamos la verificación. Revisá tu correo (y la carpeta de spam).");
            }
        } finally {
            setLoading(btnCheckVerified, false, 'Ya verifiqué, continuar');
        }
    }

    async function handleResend() {
        const user = pendingUser || auth.currentUser;
        if (!user) return;

        const restante = RESEND_COOLDOWN_MS - (Date.now() - lastVerificationSentAt);
        if (restante > 0) {
            showToast(`⏳ Esperá ${Math.ceil(restante / 1000)}s antes de volver a pedir el correo.`);
            return;
        }

        try {
            await enviarVerificacionConCooldown(user);
            showToast("📩 Te reenviamos el correo de verificación.");
            iniciarCooldownVisual(btnResend);
        } catch (error) {
            showToast("❌ " + mapAuthError(error));
        }
    }

    function iniciarCooldownVisual(el) {
        if (!el) return;
        const textoOriginal = 'Reenviar correo';
        let segundosRestantes = Math.ceil(RESEND_COOLDOWN_MS / 1000);
        el.classList.add('auth-toggle-disabled');
        el.textContent = `Reenviar correo (${segundosRestantes}s)`;

        const intervalo = setInterval(() => {
            segundosRestantes -= 1;
            if (segundosRestantes <= 0) {
                clearInterval(intervalo);
                el.classList.remove('auth-toggle-disabled');
                el.textContent = textoOriginal;
                return;
            }
            el.textContent = `Reenviar correo (${segundosRestantes}s)`;
        }, 1000);
    }

    function enterApp() {
        pendingUser = null;
        if (authContainer) authContainer.classList.add('hidden');
        showToast("✅ ¡Bienvenido!");

        setTimeout(() => {
            if (!state.map) {
                initMap();
            } else {
                state.map.invalidateSize();
            }
        }, 300);
    }
}

function setLoading(btn, loading, textoOriginal) {
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.7' : '1';
    btn.style.pointerEvents = loading ? 'none' : 'auto';
    btn.textContent = loading ? 'Cargando...' : textoOriginal;
}

// Validación de contraseña en el cliente para el registro: Firebase por sí
// solo únicamente exige 6 caracteres (auth/weak-password), así que la regla
// "un poco más segura" se agrega acá antes de llegar a createUserWithEmailAndPassword.
function validarPassword(pass) {
    if (pass.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) return "La contraseña debe combinar letras y números.";
    return null;
}

function mapAuthError(error) {
    console.error("Fallo exacto en Auth:", error.code, error.message);
    switch (error.code) {
        case 'auth/email-already-in-use': return "Este correo ya existe. Inicia sesión.";
        case 'auth/weak-password': return "La contraseña debe tener al menos 6 caracteres.";
        case 'auth/invalid-email': return "El formato del correo no es válido.";
        case 'auth/invalid-credential':
        case 'auth/wrong-password': return "Contraseña o correo incorrectos.";
        case 'auth/user-not-found': return "No existe cuenta con este correo.";
        case 'auth/too-many-requests': return "Se enviaron demasiados correos en poco tiempo. Esperá unos minutos y volvé a intentar.";
        default: return error.message;
    }
}
