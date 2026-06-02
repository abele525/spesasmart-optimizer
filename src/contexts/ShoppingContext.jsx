// ============================================================
// ShoppingContext — Gestione della lista della spesa
// Sincronizzazione real-time con Firestore per supportare
// la funzionalità Family Cloud Sync (stile Bring!)
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

const ShoppingContext = createContext(null);

export function useShopping() {
  const context = useContext(ShoppingContext);
  if (!context) throw new Error('useShopping deve essere usato dentro ShoppingProvider');
  return context;
}

export function ShoppingProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [shoppingList, setShoppingList]   = useState([]);
  const [listMetadata, setListMetadata]   = useState(null);
  const [priceAlerts, setPriceAlerts]     = useState([]);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [loading, setLoading]             = useState(true);

  // Determina l'ID della lista (usa family_id se presente, altrimenti uid)
  const getListId = useCallback(() => {
    if (userProfile?.family_id) return `family_${userProfile.family_id}`;
    return `user_${currentUser?.uid}`;
  }, [currentUser, userProfile]);

  // Ripristina il risultato ottimizzazione da localStorage al login
  useEffect(() => {
    if (!currentUser?.uid) {
      setOptimizationResult(null);
      return;
    }
    const key = `spesa_opt_${currentUser.uid}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) setOptimizationResult(JSON.parse(saved));
    } catch {
      localStorage.removeItem(key);
    }
  }, [currentUser?.uid]);

  // Sottoscrizione real-time alla lista della spesa
  useEffect(() => {
    if (!currentUser) {
      setShoppingList([]);
      setLoading(false);
      return;
    }

    const listId = getListId();
    const listRef = doc(db, 'shopping_lists', listId);

    // Prima assicura che il documento lista esista
    const ensureList = async () => {
      const snap = await getDoc(listRef);
      if (!snap.exists()) {
        await setDoc(listRef, {
          owner_uid: currentUser.uid,
          family_id: userProfile?.family_id || null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }
      setListMetadata(snap.data());
    };

    ensureList();

    // Ascolta real-time la sotto-collezione degli item
    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    const q = query(itemsRef, orderBy('created_at', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShoppingList(items);
      setLoading(false);
      // NB: il risultato ottimizzazione NON viene cancellato qui.
      // Viene cancellato solo dalle mutazioni esplicite (addItem, removeItem, updateItem).
    });

    return unsubscribe;
  }, [currentUser, userProfile, getListId]);

  // Sottoscrizione agli alert di prezzo dell'utente
  useEffect(() => {
    if (!currentUser) return;
    const alertsRef = collection(db, 'price_alerts');
    const q = query(alertsRef, where('uid', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPriceAlerts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [currentUser]);

  // --- Helpers ---

  // Invalida il risultato ottimizzazione (lista modificata)
  function invalidateOptimization() {
    setOptimizationResult(null);
    if (currentUser?.uid) {
      localStorage.removeItem(`spesa_opt_${currentUser.uid}`);
    }
  }

  // --- CRUD Lista della Spesa ---

  // Aggiunge un prodotto alla lista
  async function addItem(item) {
    const listId = getListId();
    const itemsRef = collection(db, 'shopping_lists', listId, 'items');
    await addDoc(itemsRef, {
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'pz',
      category: item.category || 'altro',
      is_stockable: item.is_stockable || false,
      target_price: item.target_price || null,
      checked: false,
      added_by: currentUser.uid,
      created_at: serverTimestamp(),
    });
    invalidateOptimization();
  }

  // Aggiorna un prodotto
  async function updateItem(itemId, data) {
    const listId = getListId();
    const itemRef = doc(db, 'shopping_lists', listId, 'items', itemId);
    await updateDoc(itemRef, { ...data, updated_at: serverTimestamp() });
    // Invalida solo se cambiano dati rilevanti (non solo lo stato checked)
    if (!('checked' in data && Object.keys(data).length === 1)) {
      invalidateOptimization();
    }
  }

  // Rimuove un prodotto
  async function removeItem(itemId) {
    const listId = getListId();
    await deleteDoc(doc(db, 'shopping_lists', listId, 'items', itemId));
    invalidateOptimization();
  }

  // Spunta/de-spunta un prodotto (non invalida l'ottimizzazione)
  async function toggleItem(itemId) {
    const item = shoppingList.find((i) => i.id === itemId);
    if (item) {
      const listId = getListId();
      const itemRef = doc(db, 'shopping_lists', listId, 'items', itemId);
      await updateDoc(itemRef, { checked: !item.checked, updated_at: serverTimestamp() });
    }
  }

  // Svuota tutti gli item spuntati
  async function clearChecked() {
    const checked = shoppingList.filter((i) => i.checked);
    await Promise.all(checked.map((i) => removeItem(i.id)));
  }

  // Svuota tutta la lista
  async function clearAll() {
    await Promise.all(shoppingList.map((i) => removeItem(i.id)));
  }

  // --- Alert di Prezzo ---

  async function addPriceAlert(productName, targetPrice) {
    const alertsRef = collection(db, 'price_alerts');
    await addDoc(alertsRef, {
      uid: currentUser.uid,
      product_name: productName,
      target_price: targetPrice,
      is_active: true,
      created_at: serverTimestamp(),
    });
  }

  async function removePriceAlert(alertId) {
    await deleteDoc(doc(db, 'price_alerts', alertId));
  }

  // Salva il risultato dell'ottimizzazione (in memoria + localStorage per sopravvivere al refresh)
  function saveOptimizationResult(result) {
    setOptimizationResult(result);
    if (currentUser?.uid) {
      const key = `spesa_opt_${currentUser.uid}`;
      if (result) {
        try { localStorage.setItem(key, JSON.stringify(result)); } catch (_e) { /* storage pieno */ }
      } else {
        localStorage.removeItem(key);
      }
    }
  }

  const value = {
    shoppingList,
    listMetadata,
    priceAlerts,
    optimizationResult,
    loading,
    addItem,
    updateItem,
    removeItem,
    toggleItem,
    clearChecked,
    clearAll,
    addPriceAlert,
    removePriceAlert,
    saveOptimizationResult,
  };

  return (
    <ShoppingContext.Provider value={value}>
      {children}
    </ShoppingContext.Provider>
  );
}
