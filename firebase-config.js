// Importa os SDKs do Firebase via CDN modular compatível
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGbIFMtMxhhHf34NrbibGqt2JkDzM170k",
    authDomain: "appodontosantos.firebaseapp.com",
    projectId: "appodontosantos",
    storageBucket: "appodontosantos.firebasestorage.app",
    messagingSenderId: "94354264227",
    appId: "1:94354264227:web:7cabbaa7051e1a3688af16",
    measurementId: "G-G8HKYD56VC"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const dbFirestore = getFirestore(app);

let usaFirebase = true;

// Disponibiliza as instâncias globalmente para o app.js usar
window.firebaseAuth = auth;
window.firebaseDb = dbFirestore;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOut = signOut;
window.doc = doc;
window.getDoc = getDoc;

console.log("🔥 Firebase inicializado com sucesso!");