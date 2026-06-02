// ============================================================
// AuthContext — Gestione dell'autenticazione utente
// Fornisce lo stato dell'utente e le funzioni di login/logout
// a tutta l'applicazione tramite React Context.
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

// Creazione del contesto
const AuthContext = createContext(null);

// Hook personalizzato per usare il contesto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato dentro AuthProvider');
  }
  return context;
}

// Provider del contesto
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carica il profilo utente da Firestore
  const loadUserProfile = useCallback(async (user) => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserProfile(snap.data());
      } else {
        // Crea profilo di default per nuovi utenti
        const defaultProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          cap_predefinito: '',
          family_id: null,
          veicolo: {
            tipo: 'benzina',
            consumo_medio: 7.0,       // L/100km
            prezzo_carburante_rif: 1.85, // €/litro
          },
          created_at: serverTimestamp(),
        };
        await setDoc(userRef, defaultProfile);
        setUserProfile(defaultProfile);
      }
    } catch (err) {
      console.error('Errore nel caricamento del profilo:', err);
    }
  }, []);

  // Ascolta i cambiamenti di autenticazione
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await loadUserProfile(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [loadUserProfile]);

  // --- Funzioni di autenticazione ---

  // Registrazione con email e password
  async function register(email, password, displayName) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    // Crea documento utente in Firestore
    const userRef = doc(db, 'users', user.uid);
    const profile = {
      uid: user.uid,
      email,
      displayName,
      cap_predefinito: '',
      family_id: null,
      veicolo: {
        tipo: 'benzina',
        consumo_medio: 7.0,
        prezzo_carburante_rif: 1.85,
      },
      created_at: serverTimestamp(),
    };
    await setDoc(userRef, profile);
    setUserProfile(profile);
    return user;
  }

  // Login con email e password
  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Login con Google
  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    await loadUserProfile(result.user);
    return result;
  }

  // Logout
  async function logout() {
    await signOut(auth);
    setUserProfile(null);
  }

  // Reset password via email
  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Aggiorna il profilo su Firestore
  async function updateUserProfile(data) {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, data, { merge: true });
    setUserProfile((prev) => ({ ...prev, ...data }));
  }

  const value = {
    currentUser,
    userProfile,
    loading,
    register,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    reloadProfile: () => loadUserProfile(currentUser),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
