/* ==========================================
   SERVICIO DE INTELIGENCIA ARTIFICIAL - GEMINI v14.0
   ========================================== */
import { app, auth, db } from '../config/firebase.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { state } from '../core/store.js';
import { addMessage, removeMessage, toggleChat } from '../ui/uiManager.js';
import { showToast } from '../utils/helpers.js';

const functions = getFunctions(app);

let isListening = false;
let recognition = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('user-msg').value = transcript;
        enviarMensajeIA(); 
    };

    recognition.onend = () => {
        isListening = false;
        const micBtn = document.getElementById('btn-mic-ai');
        if (micBtn) micBtn.classList.remove('listening');
    };

    recognition.onerror = () => {
        isListening = false;
        const micBtn = document.getElementById('btn-mic-ai');
        if (micBtn) micBtn.classList.remove('listening');
        showToast("⚠️ No se pudo escuchar bien. Intentá de nuevo.");
    };
}

export function iniciarEscucha() {
    if (!recognition) return showToast("⚠️ Tu navegador no soporta comandos de voz.");
    if (isListening) { recognition.stop(); return; }
    try {
        recognition.start();
        isListening = true;
        const micBtn = document.getElementById('btn-mic-ai');
        if (micBtn) micBtn.classList.add('listening');
        showToast("🎤 Escuchando...");
    } catch (e) { console.error(e); }
}

// --- CONFIGURACIÓN DE VOZ NATURAL Y FLUIDA ---
function hablarRespuesta(texto) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        
        const textoLimpio = texto.replace(/\*/g, '').replace(/_/g, '').replace(/#/g, '');
        const utterance = new SpeechSynthesisUtterance(textoLimpio);
        utterance.lang = 'es-ES'; 
        
        utterance.rate = 0.94; 
        utterance.pitch = 1.02;

        const voces = window.speechSynthesis.getVoices();
        const vozIdeal = voces.find(v => v.name.includes('Google español') || v.name.includes('Microsoft Helena')) 
                      || voces.find(v => v.lang.startsWith('es'));
        
        if (vozIdeal) {
            utterance.voice = vozIdeal;
        }

        window.speechSynthesis.speak(utterance);
    }
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
}

// Conecta el botón flotante, el header (para cerrar) y el envío de mensajes con
// el widget de chat. Nada de esto estaba conectado antes: el botón flotante no
// abría el chat, el header no lo cerraba y el botón de enviar no llamaba a nada.
export function initChatUI() {
    document.getElementById('btn-chat-float')?.addEventListener('click', toggleChat);
    document.getElementById('chat-header-close')?.addEventListener('click', toggleChat);

    document.getElementById('btn-send-msg')?.addEventListener('click', enviarMensajeIA);

    document.getElementById('user-msg')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarMensajeIA();
    });
}

export async function enviarMensajeIA() {
    const input = document.getElementById('user-msg'); 
    const btn = document.getElementById('btn-send-ai') || document.getElementById('btn-send-msg'); 
    const micBtn = document.getElementById('btn-mic-ai');
    if (!input) return;

    const textoUsuario = input.value.trim(); 
    if (!textoUsuario) return;

    addMessage(textoUsuario, 'user'); 
    input.value = ''; 
    input.disabled = true; 
    if(btn) btn.disabled = true;
    if(micBtn) micBtn.disabled = true;
    
    const loadingId = addMessage("Pensando... 🛰️", 'bot', true);

    let respuestaFinal = "";

    try {
        const infoLugares = state.lugares && state.lugares.length > 0 ? state.lugares.slice(0, 15).map(l => l.nombre).join(', ') : '';
        const chatConGemini = httpsCallable(functions, 'chatConGemini');
        const resultado = await chatConGemini({ textoUsuario: textoUsuario, infoLugares: infoLugares });
        respuestaFinal = resultado.data.respuesta;
    } catch (error) { 
        console.warn("Fallo Cloud Function, usando asistente correntino local:", error);
        
        // --- RESPALDO CON ACENTO Y MODISMO CORRENTINO ---
        const txt = textoUsuario.toLowerCase();
        
        if (txt.includes('colectivo') || txt.includes('bondi') || txt.includes('linea') || txt.includes('transporte')) {
            respuestaFinal = "¡Qué tal, chamigo! Las líneas de colectivos como la 101, 102, 103, 106 y 110 te llevan por todo el centro y hacia la zona de los campus. Fijate en la capa de colectivos del mapa para ver las paradas bien al detalle.";
        } else if (txt.includes('comer') || txt.includes('comida') || txt.includes('hambre') || txt.includes('restaurante') || txt.includes('cenar') || txt.includes('almorzar')) {
            respuestaFinal = "¡Achachay con el hambre! Para bajarse algo rico, date una vuelta por la Costanera o la Peatonal Junín. Tenés unos lugares de comida regional y minutas que son una picardía.";
        } else if (txt.includes('playa') || txt.includes('rio') || txt.includes('arena') || txt.includes('sol') || txt.includes('calor')) {
            respuestaFinal = "¡Tereré en mano y derecho a la playa! La Playa Arazaty frente al Paraná es fija para tomar sol y pasar la tarde. Si querés más norte, tenés la de Molina Punta.";
        } else if (txt.includes('parque') || txt.includes('plaza') || txt.includes('paseo') || txt.includes('caminar')) {
            respuestaFinal = "El Parque Cambá Cuá es sapucay puro de cultura e historia por su barrio candombero, al igual que el Parque Mitre con su viejo faro. ¡Imperdibles para caminarlos!";
        } else if (txt.includes('hola') || txt.includes('buenos dias') || txt.includes('buenas') || txt.includes('que tal')) {
            respuestaFinal = "¡Hola, chamigo! Qué gusto verte por acá. ¿En qué te puedo ayudar hoy en esta hermosa tierra correntina?";
        } else {
            const lugarEncontrado = state.lugares && state.lugares.find(l => txt.includes(l.nombre.toLowerCase()));
            if (lugarEncontrado) {
                respuestaFinal = `¡Ah, el querido ${lugarEncontrado.nombre}! Te cuento: ${lugarEncontrado.descripcion || 'es uno de los puntos infaltables de la ciudad'}. ¿Querés que armemos el viaje para ir rumbeando para allá?`;
            } else {
                respuestaFinal = `¡Mire usté! Estuve pensando en lo que me decís de "${textoUsuario}". Por Corrientes lo mejor es recorrer la Costanera, cruzar al Chaco por el puente o tomarse unos mates en las plazas. ¿Qué te gustaría visitar?`;
            }
        }
    } finally { 
        removeMessage(loadingId); 
        addMessage(respuestaFinal, 'bot');
        hablarRespuesta(respuestaFinal);

        input.disabled = false; 
        if(btn) btn.disabled = false; 
        if(micBtn) micBtn.disabled = false;
        input.focus(); 
    }
}