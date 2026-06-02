// ============================================================
// ShoppingList — Lista della spesa con tab Lista / Scorta / Alert
// ============================================================
import { useState, useRef } from 'react';
import {
  Plus, ShoppingCart, Trash2, CheckCheck, Users, TrendingDown,
  Package, Bell, RefreshCw, Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShopping } from '../../contexts/ShoppingContext';
import { useAuth } from '../../contexts/AuthContext';
import ProductItem from './ProductItem';
import AddProductModal from './AddProductModal';
import PriceAlertsPanel from './PriceAlertsPanel';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const CATEGORY_META = {
  frutta_verdura:   { label: 'Frutta & Verdura',    emoji: '🥦' },
  carne_pesce:      { label: 'Carne & Pesce',        emoji: '🥩' },
  latticini:        { label: 'Latticini & Uova',     emoji: '🥛' },
  pane_pasticceria: { label: 'Pane & Pasticceria',   emoji: '🍞' },
  pasta_riso:       { label: 'Pasta & Riso',          emoji: '🍝' },
  bevande:          { label: 'Bevande',               emoji: '🥤' },
  snack:            { label: 'Snack & Dolci',         emoji: '🍫' },
  surgelati:        { label: 'Surgelati',             emoji: '🧊' },
  pulizia:          { label: 'Pulizia Casa',          emoji: '🧹' },
  cura_persona:     { label: 'Cura Persona',          emoji: '💆' },
  altro:            { label: 'Altro',                 emoji: '📦' },
};

const TABS = [
  { id: 'lista',  label: 'Lista',  icon: ShoppingCart },
  { id: 'scorta', label: 'Scorta', icon: Package },
  { id: 'alert',  label: 'Alert',  icon: Bell },
];

export default function ShoppingList({ initialTab = 'lista' }) {
  const { shoppingList, loading, clearChecked, updateItem, priceAlerts, addItem } = useShopping();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showModal, setShowModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate                  = useNavigate();
  const importInputRef            = useRef(null);

  // Mappa categorie MealPlanner → SpesaSmart
  const CATEGORY_MAP = {
    'Verdure':             'frutta_verdura',
    'Frutta':              'frutta_verdura',
    'Proteine (carne)':    'carne_pesce',
    'Proteine (pesce)':    'carne_pesce',
    'Uova e latticini':    'latticini',
    'Cereali e pane':      'pasta_riso',
    'Legumi':              'pasta_riso',
    'Frutta secca e semi': 'snack',
    'Condimenti e olio':   'altro',
    'Altro':               'altro',
  };

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.spesasmart_import || !Array.isArray(data.items))
        throw new Error('File non valido — usa il pulsante "Esporta per SpesaSmart" su MealPlanner AI.');
      let count = 0;
      for (const item of data.items) {
        await addItem({
          name: item.name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? 'pz',
          category: CATEGORY_MAP[item.mealplanner_category] ?? item.category ?? 'altro',
          is_stockable: false,
        });
        count++;
      }
      toast.success(`✅ ${count} ingredienti importati da MealPlanner!`);
    } catch (err) {
      toast.error(err.message || 'Errore durante l\'importazione');
    } finally {
      setImporting(false);
    }
  }

  const unchecked  = shoppingList.filter((i) => !i.checked);
  const checked    = shoppingList.filter((i) => i.checked);
  const stockables = shoppingList.filter((i) => i.is_stockable);
  const activeAlerts = priceAlerts.filter((a) => a.is_active);

  // Raggruppa per categoria (solo unchecked, tab lista)
  const byCategory = unchecked.reduce((acc, item) => {
    const cat = item.category || 'altro';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  async function handleClearChecked() {
    if (checked.length === 0) return;
    if (!confirm(`Rimuovere ${checked.length} prodotti spuntati?`)) return;
    try {
      await clearChecked();
      toast.success('Prodotti spuntati rimossi');
    } catch {
      toast.error('Errore durante la rimozione');
    }
  }

  // Riordina un prodotto scorta: lo de-spunta così torna "da comprare"
  async function handleReorder(item) {
    try {
      await updateItem(item.id, { checked: false });
      toast.success(`"${item.name}" rimesso in lista`);
    } catch {
      toast.error('Errore durante il riordino');
    }
  }

  if (loading) return <LoadingSpinner text="Caricamento lista..." />;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary-600" />
            Lista della Spesa
          </h1>
          <p className="section-subtitle">
            {shoppingList.length === 0
              ? 'La lista è vuota — aggiungi qualcosa!'
              : `${unchecked.length} da comprare · ${checked.length} spuntati`}
          </p>
          {userProfile?.family_id && (
            <div className="flex items-center gap-1.5 text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg mt-1 w-fit">
              <Users className="h-3 w-3" />
              Lista condivisa con la famiglia
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {/* Importa da MealPlanner */}
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            title="Importa lista da MealPlanner AI"
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importo…' : 'Da MealPlanner'}
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Aggiungi
          </button>
        </div>
      </div>

      {/* Pulsante ottimizza */}
      {shoppingList.length > 0 && activeTab === 'lista' && (
        <button
          onClick={() => navigate('/ottimizza')}
          className="w-full mb-4 p-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm"
        >
          <TrendingDown className="h-5 w-5" />
          Ottimizza percorso e prezzi
        </button>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === 'scorta' ? stockables.length : id === 'alert' ? activeAlerts.length : 0;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === id ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB: Lista ── */}
      {activeTab === 'lista' && (
        <>
          {shoppingList.length === 0 && (
            <div className="text-center py-16">
              <ShoppingCart className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">Lista vuota</p>
              <p className="text-gray-400 text-sm mt-1 mb-6">
                Aggiungi i prodotti che devi comprare
              </p>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="h-4 w-4 inline mr-2" />
                Aggiungi il primo prodotto
              </button>
            </div>
          )}

          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category} className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-base">{CATEGORY_META[category]?.emoji || '📦'}</span>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {CATEGORY_META[category]?.label || category}
                </h3>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <ProductItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}

          {checked.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                  <CheckCheck className="h-4 w-4" />
                  Già nel carrello ({checked.length})
                </h3>
                <button
                  onClick={handleClearChecked}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Rimuovi spuntati
                </button>
              </div>
              <div className="space-y-2">
                {checked.map((item) => (
                  <ProductItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Scorta ── */}
      {activeTab === 'scorta' && (
        <ScortaTab
          stockables={stockables}
          onReorder={handleReorder}
          onAddNew={() => setShowModal(true)}
        />
      )}

      {/* ── TAB: Alert prezzi ── */}
      {activeTab === 'alert' && <PriceAlertsPanel />}

      {showModal && <AddProductModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Sezione Scorta ──────────────────────────────────────────
function ScortaTab({ stockables, onReorder, onAddNew }) {
  const toBuy   = stockables.filter((i) => !i.checked);
  const bought  = stockables.filter((i) => i.checked);

  if (stockables.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="h-16 w-16 text-gray-200 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-medium">Nessun prodotto in scorta</p>
        <p className="text-gray-400 text-sm mt-1 mb-6 max-w-xs mx-auto">
          Aggiungi prodotti che tieni sempre in casa. Ti ricorderemo di ricomprarli quando finiscono.
        </p>
        <button onClick={onAddNew} className="btn-primary">
          <Plus className="h-4 w-4 inline mr-2" />
          Aggiungi prodotto scorta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Da comprare */}
      {toBuy.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3">
            <ShoppingCart className="h-3.5 w-3.5" />
            Da comprare ({toBuy.length})
          </h3>
          <div className="space-y-2">
            {toBuy.map((item) => (
              <ProductItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Già comprati — con pulsante Riordina */}
      {bought.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3">
            <CheckCheck className="h-3.5 w-3.5" />
            Già comprati ({bought.length})
          </h3>
          <div className="space-y-2">
            {bought.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50"
              >
                <Package className="h-5 w-5 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 line-through">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.quantity} {item.unit}</p>
                </div>
                <button
                  onClick={() => onReorder(item)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Riordina
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Usa il pulsante &quot;Scorta&quot; su ogni prodotto per aggiungerlo o rimuoverlo da questa lista.
      </p>
    </div>
  );
}
