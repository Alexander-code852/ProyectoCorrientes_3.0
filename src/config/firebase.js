/* ==========================================
   CONFIGURACIÓN DE FIREBASE - src/config/firebase.js
   ========================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC50z3jZ8R5KkRfyS8zxImDsp5wQzq1FA0",
    authDomain: "ruta-correntina.firebaseapp.com",
    projectId: "ruta-correntina",
    storageBucket: "ruta-correntina.firebasestorage.app",
    messagingSenderId: "56680191985",
    appId: "1:56680191985:web:31c97e7c4e0daee5bd1650",
    measurementId: "G-P7G3Z655X4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };