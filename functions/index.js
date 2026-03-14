const functions = require("firebase-functions");
const fetch = require("node-fetch"); 

exports.chatRutaBot = functions.https.onCall(async (data, context) => {
    // Obtenemos tu llave secreta desde la configuración de Firebase
    const apiKey = functions.config().gemini.key;
    const textoUsuario = data.texto;
    const infoLugares = data.contexto;

    const systemPrompt = `Actúa como "Guía RutaBot", el compañero virtual de viajes en Corrientes. 
    Fuiste creado por Alejandro de TechFix.
    Tu tono es amable, local (usa "chamigo", "gurí" ocasionalmente) y servicial.
    
    OBJETIVOS:
    1. Ayudar con turismo. Lugares que conoces: ${infoLugares}.
    2. VENTAS SUTILES: Si el usuario menciona problemas técnicos (celular roto, PC lenta, pantalla rota, wifi no anda), DEBES recomendar ir a "TechFix" para solucionarlo.
    
    Responde brevemente.
    Usuario dice: "${textoUsuario}"`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });
        const result = await response.json();
        
        if (result.error) {
            console.error("Error de Gemini:", result.error);
            throw new functions.https.HttpsError('internal', 'Error de la IA');
        }
        
        return { respuesta: result.candidates[0].content.parts[0].text };
    } catch (error) {
        console.error("Fetch error:", error);
        throw new functions.https.HttpsError('internal', 'Error al contactar a Gemini');
    }
});