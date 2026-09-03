// src/services/geminiAi.js
import { functions, httpsCallable } from '../config/firebase.js';
import { state } from '../core/store.js';
import { addMessage, removeMessage } from '../ui/uiManager.js';

export async function enviarMensajeIA() {
    const input = document.getElementById('user-msg'); 
    const btn = document.getElementById('btn-send-ai'); 
    const textoUsuario = input.value.trim(); 
    if (!textoUsuario) return;

    addMessage(textoUsuario, 'user'); 
    input.value = ''; input.disabled = true; if(btn) btn.disabled = true;
    const loadingId = addMessage("Conectando... 🛰️", 'bot', true);

    try {
        const infoLugares = state.lugares.slice(0, 15).map(l => l.nombre).join(', ');
        const chatConGemini = httpsCallable(functions, 'chatConGemini');
        const resultado = await chatConGemini({ textoUsuario: textoUsuario, infoLugares: infoLugares });
        
        removeMessage(loadingId); 
        addMessage(resultado.data.respuesta, 'bot');
    } catch (error) { 
        removeMessage(loadingId); 
        addMessage("Hubo un error de conexión 🧉.", 'bot'); 
    } finally { 
        input.disabled = false; if(btn) btn.disabled = false; input.focus(); 
    }
}