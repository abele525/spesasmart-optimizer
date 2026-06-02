// ============================================================
// RouteOptimizer — Componente principale per l'ottimizzazione
// Step 1: posizione → Step 2: seleziona negozi + prezzi → Step 3: risultati
// ============================================================
import { useState, useCallback, useMemo } from 'react';
import { Search, MapPin, TrendingDown, RefreshCw, Store, AlertCircle, Map, Printer, Star, Check as CheckIcon } from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useShopping } from '../../contexts/ShoppingContext';
import CostBreakdown from './CostBreakdown';
import PriceTable, { buildPriceData } from './PriceTable';
import { solveTSP, buildHaversineMatrix } from '../../lib/algorithms/tsp';
import { calcolaCostoReale, calcolaCostoConTraffico } from '../../lib/algorithms/costCalculator';
import { searchNearbySupermarkets, getDistanceMatrix } from '../../lib/maps';
import { printShoppingReport } from '../../lib/printReport';
import { getDemoPrice } from '../../lib/demoPrices';
import toast from 'react-hot-toast';

const MAPS_LIBRARIES = ['places'];

// Calcola il totale del percorso multi-negozio scegliendo il prezzo minimo per ogni prodotto.
// Deriva i prezzi da priceData (già calcolato) invece di chiamare getDemoPrice di nuovo.
function calcolaPrezziMultiNegozio(pd) {
  const totale = pd.reduce((sum, row) => sum + row.cheapest.unitPrice * (row.quantity || 1), 0);
  return { totale };
}

function buildDistanceMatrixFromGM(response, n) {
  const matrix = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) matrix[i][i] = 0;
  response.rows?.forEach((row, i) => {
    row.elements?.forEach((el, j) => {
      if (el.status === 'OK') matrix[i][j] = el.distance.value / 1000;
    });
  });
  return matrix;
}

export default function RouteOptimizer() {
  const { userProfile, currentUser }   = useAuth();
  const { shoppingList, saveOptimizationResult, optimizationResult } = useShopping();
  const navigate                       = useNavigate();

  const { isLoaded: mapsLoaded, loadError: mapsError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: MAPS_LIBRARIES,
  });

  const [step, setStep]                 = useState(optimizationResult ? 3 : 1);
  const [address, setAddress]           = useState(userProfile?.indirizzo || userProfile?.cap_predefinito || '');
  const [supermarkets, setSupermarkets] = useState([]);
  const [selected, setSelected]         = useState([]);
  const [searching, setSearching]       = useState(false);
  const [optimizing, setOptimizing]     = useState(false);
  const [userCoords, setUserCoords]     = useState(null);

  const prefKey = currentUser ? `spesa_preferred_stores_${currentUser.uid}` : null;
  const [savedPrefNames, setSavedPrefNames] = useState(() =>
    prefKey ? JSON.parse(localStorage.getItem(prefKey) || '[]') : []
  );

  // Pre-seleziona i preferiti salvati dopo una ricerca; se non ce ne sono, seleziona tutti
  function applyPreferredStores(stores) {
    const saved = prefKey ? JSON.parse(localStorage.getItem(prefKey) || '[]') : [];
    setSavedPrefNames(saved);
    if (saved.length > 0) {
      const matched = stores.filter((s) => saved.includes(s.insegna)).map((s) => s.sid);
      setSelected(matched.length > 0 ? matched : stores.map((s) => s.sid));
    } else {
      setSelected(stores.map((s) => s.sid)); // prima volta: seleziona tutti
    }
  }

  // Salva esplicitamente la selezione corrente come preferiti
  function savePreferred() {
    if (!prefKey) return;
    const names = supermarkets.filter((s) => selected.includes(s.sid)).map((s) => s.insegna);
    localStorage.setItem(prefKey, JSON.stringify(names));
    setSavedPrefNames(names);
    toast.success('Preferiti salvati!');
  }

  // Torna alla selezione dei preferiti salvati
  function selectSavedPreferred() {
    if (savedPrefNames.length === 0) return;
    const sids = supermarkets.filter((s) => savedPrefNames.includes(s.insegna)).map((s) => s.sid);
    setSelected(sids);
  }

  const currentSelectionNames = supermarkets.filter((s) => selected.includes(s.sid)).map((s) => s.insegna);
  const prefChanged = JSON.stringify([...currentSelectionNames].sort()) !== JSON.stringify([...savedPrefNames].sort());

  const items = useMemo(() => shoppingList.filter((i) => !i.checked), [shoppingList]);

  // Negozi selezionati (oggetti completi)
  const selectedStores = useMemo(
    () => supermarkets.filter((s) => selected.includes(s.sid)),
    [supermarkets, selected]
  );

  // Tabella prezzi calcolata in tempo reale sui negozi selezionati
  const priceData = useMemo(
    () => selectedStores.length > 0 ? buildPriceData(items, selectedStores, getDemoPrice) : [],
    [items, selectedStores]
  );

  // Passo 1: cerca supermercati vicini
  const handleSearch = useCallback(async () => {
    if (!address || address.trim().length < 3) return toast.error('Inserisci il tuo indirizzo o CAP');
    if (items.length === 0) return toast.error('La lista è vuota! Aggiungi prodotti prima.');

    setSearching(true);
    try {
      let coords;
      let cityName;

      if (userProfile?.indirizzo_coords && userProfile?.indirizzo === address) {
        coords   = userProfile.indirizzo_coords;
        cityName = userProfile.indirizzo.split(',').slice(-2).join(',').trim();
      } else {
        const query = /^\d{5}$/.test(address.trim())
          ? `postalcode=${address.trim()}&country=Italy`
          : `q=${encodeURIComponent(address + ', Italy')}`;
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?${query}&format=json&limit=1`,
          { headers: { 'Accept-Language': 'it' } }
        );
        const data = await res.json();
        if (!data || data.length === 0) return toast.error('Indirizzo non trovato. Prova a essere più preciso.');
        coords   = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        cityName = data[0].display_name.split(',')[0].trim();
      }
      setUserCoords(coords);

      if (mapsLoaded && !mapsError && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
        try {
          const nearby = await searchNearbySupermarkets(coords, 10);
          if (nearby.length === 0) {
            toast(`Nessun supermercato trovato entro 10km da ${cityName}`, { icon: '📍' });
          } else {
            toast.success(`${nearby.length} supermercati trovati vicino a ${cityName}`);
          }
          setSupermarkets(nearby);
          applyPreferredStores(nearby);
          setStep(2);
          return;
        } catch (err) {
          console.warn('Places API non disponibile, uso dati demo:', err.message);
        }
      }

      const demoStores = generateDemoSupermarkets(coords, cityName);
      setSupermarkets(demoStores);
      applyPreferredStores(demoStores);
      setStep(2);
      toast(`Supermercati demo intorno a ${cityName}`, { icon: 'ℹ️', duration: 4000 });
    } catch (err) {
      toast.error('Errore durante la ricerca. Riprova.');
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, [address, items.length, mapsLoaded, mapsError, userProfile]);

  function generateDemoSupermarkets(center, cityName = '') {
    const city   = cityName.split(',')[0].trim() || address;
    const stores = ['Esselunga', 'Coop', 'Lidl', 'Carrefour', 'Conad', 'Penny'];
    return stores.map((name, i) => ({
      sid: `demo_${i}`,
      insegna: name,
      address: `Via Demo ${i + 1}, ${city}`,
      coordinate: {
        lat: center.lat + (Math.random() - 0.5) * 0.12,
        lng: center.lng + (Math.random() - 0.5) * 0.12,
      },
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      open_now: Math.random() > 0.2,
      is_demo: true,
    }));
  }

  function toggleSelect(sid) {
    setSelected((prev) => prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid]);
  }

  // Passo 3: calcola percorso ottimale e costo reale
  const handleOptimize = useCallback(async () => {
    if (selected.length === 0) return toast.error('Seleziona almeno un supermercato');

    setOptimizing(true);
    try {
      const veicolo    = userProfile?.veicolo || { consumo_medio: 7.0, prezzo_carburante_rif: 1.85, tipo: 'benzina' };
      const allPoints  = [userCoords, ...selectedStores.map((s) => s.coordinate)];
      let distMatrix;
      let routeInfo = null;

      try {
        const gmResp = await getDistanceMatrix(userCoords, selectedStores.map((s) => s.coordinate));
        distMatrix   = buildDistanceMatrixFromGM(gmResp, allPoints.length);
        routeInfo    = { durataMin: 20, durataBaseMin: 15 };
      } catch {
        distMatrix = buildHaversineMatrix(allPoints);
      }

      const { orderedLocations, totalKm } = solveTSP(selectedStores, distMatrix);

      // Totale per ogni negozio — ricavato da priceData già memoizzato
      const prezziPerNegozio = selectedStores.map((_, idx) =>
        priceData.reduce((sum, row) => sum + row.prices[idx].total, 0)
      );

      // Scenario 1: negozio singolo più economico
      const minIdx        = prezziPerNegozio.indexOf(Math.min(...prezziPerNegozio));
      const prezzoSingolo = prezziPerNegozio[minIdx];
      const kmSingolo     = (distMatrix[0][minIdx + 1] || 5) * 2;
      const costoSingolo  = calcolaCostoReale(prezzoSingolo, kmSingolo, veicolo);

      // Scenario 2: percorso multi-negozio TSP (prezzo minimo per prodotto)
      const prezziMulti = calcolaPrezziMultiNegozio(priceData);
      const costoMulti  = calcolaCostoConTraffico(
        prezziMulti.totale,
        totalKm * 1.1,
        routeInfo?.durataMin || 30,
        routeInfo?.durataBaseMin || 25,
        veicolo
      );

      const risparmioNetto = costoSingolo.costoReale - costoMulti.costoReale;

      const result = {
        scenario_singolo: {
          nome_supermercato: selectedStores[minIdx]?.insegna,
          somma_prezzi:      Math.round(prezzoSingolo * 100) / 100,
          costo_carburante:  costoSingolo.costoCarburante,
          costo_reale:       costoSingolo.costoReale,
          km:                Math.round(kmSingolo * 10) / 10,
          durata_min:        Math.round(kmSingolo / 50 * 60),
        },
        scenario_ottimale: {
          supermercati:     orderedLocations,
          somma_prezzi:     Math.round(prezziMulti.totale * 100) / 100,
          costo_carburante: costoMulti.costoCarburante,
          costo_reale:      costoMulti.costoReale,
          km:               totalKm,
          durata_min:       routeInfo?.durataMin || 30,
          durata_base_min:  routeInfo?.durataBaseMin || 25,
          fattore_traffico: costoMulti.fattoreTraffico,
        },
        risparmio_netto:  Math.round(risparmioNetto * 100) / 100,
        consiglia_multi:  risparmioNetto > 0,
        ordered_route:    orderedLocations,
        best_single_store: selectedStores[minIdx] || null, // negozio singolo consigliato
        total_km:         totalKm,
        veicolo,
        address_used:     address,
        stores_selected:  selectedStores,
        price_data_snapshot: priceData,
      };

      saveOptimizationResult(result);
      setStep(3);
      toast.success('Ottimizzazione completata!');
    } catch (err) {
      console.error(err);
      toast.error('Errore durante l\'ottimizzazione. Riprova.');
    } finally {
      setOptimizing(false);
    }
  }, [selected, selectedStores, userCoords, userProfile, saveOptimizationResult, address, priceData]);


  function handleReset() {
    setStep(1);
    setSupermarkets([]);
    setSelected([]);
    setUserCoords(null);
    // I preferiti restano in localStorage — verranno riapplicati alla prossima ricerca
  }

  // Stampa PDF
  function handlePrint() {
    const result = optimizationResult;
    if (!result) return toast.error('Prima esegui un\'ottimizzazione');

    // Usa i dati salvati nel risultato (price_data_snapshot) o quelli correnti
    const pd     = result.price_data_snapshot || priceData;
    const stores = result.stores_selected || selectedStores;

    if (pd.length === 0 || stores.length === 0) {
      toast.error('Nessun dato da stampare. Esegui prima l\'ottimizzazione.');
      return;
    }

    printShoppingReport({
      priceData:          pd,
      stores:             stores,
      optimizationResult: result,
      veicolo:            userProfile?.veicolo,
      userName:           userProfile?.displayName,
      address:            result.address_used || address,
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="section-title flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-primary-600" />
          Smart Trip Optimizer
        </h1>
        <p className="section-subtitle">
          Calcola il percorso più conveniente tenendo conto del traffico e del carburante
        </p>
      </div>

      {/* ── Step 1: indirizzo ── */}
      <div className={`card mb-4 ${step !== 1 ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <StepBadge n={1} active={step >= 1} />
          <h2 className="font-semibold text-gray-900">La tua posizione</h2>
          {step > 1 && (
            <button onClick={handleReset} className="ml-auto text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Ricomincia
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && step === 1 && handleSearch()}
              className="input-field pl-10"
              placeholder="Indirizzo o CAP (es. Via Roma 1, 51031 Agliana)"
              disabled={step > 1}
            />
          </div>
          {step === 1 && (
            <button onClick={handleSearch} disabled={searching} className="btn-primary flex items-center gap-2 px-6">
              {searching
                ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full spinner" />
                : <Search className="h-4 w-4" />}
              {searching ? 'Ricerca...' : 'Cerca'}
            </button>
          )}
        </div>
        {items.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            La lista è vuota. Aggiungi prodotti prima di ottimizzare.
          </div>
        )}
      </div>

      {/* ── Step 2: selezione supermercati + tabella prezzi ── */}
      {step >= 2 && supermarkets.length > 0 && (
        <div className="card mb-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <StepBadge n={2} active />
            <h2 className="font-semibold text-gray-900">Scegli i supermercati</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4 ml-8">
            Tocca un negozio per includerlo o escluderlo dal confronto
          </p>

          {/* Azioni rapide */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelected(supermarkets.map((s) => s.sid))}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                selected.length === supermarkets.length
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
              }`}
            >
              Tutti ({supermarkets.length})
            </button>
            {savedPrefNames.length > 0 && (
              <button
                onClick={selectSavedPreferred}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1 ${
                  !prefChanged
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                }`}
              >
                <Star className="h-3 w-3" />
                Preferiti ({savedPrefNames.length})
              </button>
            )}
            <button
              onClick={() => setSelected([])}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 font-medium hover:border-red-300 hover:text-red-500 transition-all"
            >
              Nessuno
            </button>
          </div>

          {/* Lista negozi — selezionati in cima, poi gli altri */}
          <div className="space-y-2 mb-4 max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {[...supermarkets]
              .sort((a, b) => {
                const aOn = selected.includes(a.sid);
                const bOn = selected.includes(b.sid);
                return aOn === bOn ? 0 : aOn ? -1 : 1;
              })
              .map((store) => {
                const isSelected = selected.includes(store.sid);
                const isPref     = savedPrefNames.includes(store.insegna);
                return (
                  <button
                    key={store.sid}
                    onClick={() => toggleSelect(store.sid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Checkmark / cerchio vuoto */}
                    <span className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckIcon className="h-3 w-3 text-white stroke-[3]" />}
                    </span>

                    <Store className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />

                    {/* Nome e indirizzo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>
                          {store.insegna}
                        </p>
                        {isPref && <Star className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      </div>
                      {store.address && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{store.address}</p>
                      )}
                    </div>

                    {/* Stato apertura */}
                    {store.open_now !== null && store.open_now !== undefined && (
                      <span className={`text-[10px] font-medium flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                        store.open_now ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {store.open_now ? 'Aperto' : 'Chiuso'}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Salva preferiti — appare solo se la selezione è cambiata */}
          {selected.length > 0 && prefChanged && (
            <button
              onClick={savePreferred}
              className="w-full mb-3 flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 hover:bg-amber-100 transition-colors"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              Salva questa selezione come preferiti
            </button>
          )}

          {/* Bottone calcola */}
          <button
            onClick={handleOptimize}
            disabled={optimizing || selected.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {optimizing
              ? <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full spinner" /> Calcolo in corso...</>
              : <><TrendingDown className="h-4 w-4" /> Calcola Costo Reale ({selected.length} negozi selezionati)</>}
          </button>
          {selected.length === 0 && (
            <p className="text-xs text-red-500 text-center mt-2">Seleziona almeno un supermercato</p>
          )}
        </div>
      )}

      {/* Tabella prezzi — visibile appena si seleziona almeno un negozio (step 2) */}
      {step >= 2 && priceData.length > 0 && (
        <PriceTable priceData={priceData} stores={selectedStores} />
      )}

      {/* ── Step 3: risultati ── */}
      {step >= 3 && optimizationResult && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <StepBadge n={3} active />
            <h2 className="font-semibold text-gray-900">Risultati ottimizzazione</h2>
          </div>

          <CostBreakdown result={optimizationResult} veicolo={userProfile?.veicolo} />

          {/* Percorso consigliato — mostrato solo se il multi-negozio conviene */}
          {optimizationResult.consiglia_multi && optimizationResult.ordered_route?.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary-600" />
                Percorso ottimale ({optimizationResult.ordered_route.length} negozi)
              </h3>
              <ol className="space-y-2">
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">🏠</span>
                  <span className="text-gray-600 truncate">{optimizationResult.address_used || 'Casa tua'}</span>
                </li>
                {optimizationResult.ordered_route.map((store, idx) => (
                  <li key={store.sid || idx} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-gray-900">{store.insegna}</span>
                    {store.address && <span className="text-gray-500 text-xs truncate">{store.address}</span>}
                  </li>
                ))}
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs flex-shrink-0">🏠</span>
                  <span className="text-gray-500">Ritorno a casa</span>
                </li>
              </ol>
            </div>
          )}

          {/* Negozio singolo consigliato — mostrato quando NON conviene girare più negozi */}
          {!optimizationResult.consiglia_multi && optimizationResult.best_single_store && (
            <div className="card mt-4 border-primary-200 bg-primary-50/30">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary-600" />
                Negozio consigliato
              </h3>
              <ol className="space-y-2">
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">🏠</span>
                  <span className="text-gray-600 truncate">{optimizationResult.address_used || 'Casa tua'}</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span className="font-semibold text-gray-900">{optimizationResult.best_single_store.insegna}</span>
                  {optimizationResult.best_single_store.address && (
                    <span className="text-gray-500 text-xs truncate">{optimizationResult.best_single_store.address}</span>
                  )}
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs flex-shrink-0">🏠</span>
                  <span className="text-gray-500">Ritorno a casa</span>
                </li>
              </ol>
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-primary-100">
                Girare più negozi costerebbe di più per il carburante aggiuntivo. Conviene fare tutto qui.
              </p>
            </div>
          )}

          {/* Azioni finali */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => navigate('/mappa')}
              className="btn-primary flex-1 flex items-center justify-center gap-2 min-w-[140px]"
            >
              <Map className="h-4 w-4" />
              Vedi su mappa
            </button>
            <button
              onClick={handlePrint}
              className="btn-secondary flex items-center justify-center gap-2 px-5"
            >
              <Printer className="h-4 w-4" />
              Stampa / PDF
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary flex items-center justify-center gap-2 px-5"
            >
              <RefreshCw className="h-4 w-4" />
              Nuova ricerca
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Badge numerato per gli step
function StepBadge({ n, active }) {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
      active ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
    }`}>
      {n}
    </div>
  );
}
