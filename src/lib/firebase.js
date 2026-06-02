// ============================================================
// Firebase SDK — Configurazione e inizializzazione
// Tutti i valori sensibili vengono letti dalle variabili d'ambiente (.env)
// ============================================================
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';

// Configurazione letta da variabili d'ambiente Vite (prefisso VITE_)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inizializzazione app Firebase
const app = initializeApp(firebaseConfig);

// Servizi esportati
export const auth = getAuth(app);

// Firestore con persistenza offline (IndexedDB) per funzionare senza rete
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const functions = getFunctions(app, 'europe-west1'); // Regione europea per rispettare GDPR
export const googleProvider = new GoogleAuthProvider();

// Firebase Cloud Messaging (notifiche push) — inizializzato solo se supportato dal browser
export let messaging = null;
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
});

export default app;
