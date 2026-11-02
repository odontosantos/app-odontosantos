// firebase-config.js corrigido (Padrão Compat 9.22.0)
const firebaseConfig = {
    apiKey: "AIzaSyCGbIFMtMxhhHf34NrbibGqt2JkDzM170k",
    authDomain: "appodontosantos.firebaseapp.com",
    projectId: "appodontosantos",
    storageBucket: "appodontosantos.firebasestorage.app",
    messagingSenderId: "94354264227",
    appId: "1:94354264227:web:7cabbaa7051e1a3688af16",
    measurementId: "G-G8HKYD56VC"
};

// Inicializa usando o SDK Compat global carregado no HTML
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const dbFirestore = firebase.firestore();

// Expõe globalmente para o app.js
window.usaFirebase = true;
window.firebase = firebase;
window.firebaseAuth = auth;
window.firebaseDb = dbFirestore;

window.signInWithEmailAndPassword = (authInstance, email, senha) => {
    return authInstance.signInWithEmailAndPassword(email, senha);
};

window.signOut = (authInstance) => {
    return authInstance.signOut();
};

window.doc = (db, collectionName, docId) => {
    return db.collection(collectionName).doc(docId);
};

window.getDoc = async (docRef) => {
    const snap = await docRef.get();
    return {
        exists: () => snap.exists,
        data: () => snap.data()
    };
};

window.setDoc = async (docRef, data) => {
    return await docRef.set(data);
};

// 🔥 ADICIONADO: Expõe o onSnapshot globalmente para suporte ao tempo real via Compat
window.onSnapshot = (docRef, callback) => {
    return docRef.onSnapshot((snap) => {
        callback({
            exists: () => snap.exists,
            data: () => snap.data()
        });
    });
};

console.log("🔥 Firebase Compat 9.22.0 inicializado com sucesso!");
