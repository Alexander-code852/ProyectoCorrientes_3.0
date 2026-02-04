/* firebase.js - CONEXIÓN LIMPIA */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDlli0VXIC9yNy4ChQofBc0KH8c-EYNEY",
  authDomain: "ruta-correntina.firebaseapp.com",
  projectId: "ruta-correntina",
  storageBucket: "ruta-correntina.firebasestorage.app",
  messagingSenderId: "56680191985",
  appId: "1:56680191985:web:31c97e7c4e0daee5bd1650",
  measurementId: "G-P7G3Z655X4"
};

// Inicializamos
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, getDocs, addDoc, doc, setDoc, getDoc, updateDoc, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile };