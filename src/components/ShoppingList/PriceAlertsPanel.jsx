// ============================================================
// PriceAlertsPanel — Gestione alert prezzi
// Mostra, aggiunge e rimuove alert; controlla prezzi demo
// ============================================================
import { useState } from 'react';
import { Bell, Plus, Trash2, TrendingDown, X } from 'lucide-react';
import { useShopping } from '../../contexts/ShoppingContext';
import toast from 'react-hot-toast';

const DEMO_PRICES = {
  'Pasta':      { min: 0.89, max: 1.59 },
  'Latte':      { min: 1.19, max: 1.89 },
  'Pane':       { min: 1.29, max: 2.49 },
  'Uova':       { min: 2.49, max: 3.89 },
  'Caffè':      { min: 2.99, max: 4.49 },
  'Detersivo':  { min: 3.49, max: 5.99 },
  default:      { min: 1.00, max: 3.00 },
};

const DEMO_STORES = ['Esselunga', 'Coop', 'Lidl', 'Carrefour', 'Conad', 'Penny'];

function getDemoPrice(productName, idx) {
  const range = DEMO_PRICES[productName.trim()] || DEMO_PRICES.default;
  const seed  = (productName.trim().length + idx * 7) % 10;
  return range.min + (seed / 10) * (range.max - range.min);
}

function getBestPrice(productName) {
  let best = Infinity;
  let bestStore = '';
  DEMO_STORES.forEach((store, idx) => {
    const p = getDemoPrice(productName, idx);
    if (p < best) { best = p; bestStore = store; }
  });
  return { price: best, store: bestStore };
}

export default function PriceAlertsPanel() {
  const { priceAlerts, addPriceAlert, removePriceAlert } = useShopping();
  const [showForm, setShowForm]     = useState(false);
  const [productName, setProductName] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading]       = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!productName.trim()) return toast.error('Inserisci il nome del prodotto');
    if (!targetPrice || Number(targetPrice) <= 0) return toast.error('Inserisci un prezzo valido');

    setLoading(true);
    try {
      await addPriceAlert(productName.trim(), Number(targetPrice));
      toast.success(`Alert creato per "${productName.trim()}"`);
      setProductName('');
      setTargetPrice('');
      setShowForm(false);
    } catch {
      toast.error('Errore durante la creazione dell\'alert');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(alertId, name) {
    try {
      await removePriceAlert(alertId);
      toast.success(`Alert per "${name}" rimosso`);
    } catch {
      toast.error('Errore durante la rimozione');
    }
  }

  const triggered = priceAlerts.filter((a) => {
    const best = getBestPrice(a.product_name);
    return best.price <= a.target_price;
  });

  return (
    <div>
      {/* Header con contatore */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900">Alert Prezzi</h2>
          {triggered.length > 0 && (
            <span className="badge-purple">{triggered.length} attivati</span>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
        >
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? 'Annulla' : 'Nuovo alert'}
        </button>
      </div>

      {/* Form creazione alert */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-purple-50 rounded-xl p-4 border border-purple-100 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prodotto</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="input-field text-sm"
              placeholder="es. Pasta, Latte, Caffè..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Avvisami se il prezzo scende sotto (€)
            </label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="input-field text-sm"
              placeholder="es. 1.50"
              min={0.01}
              step={0.01}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full text-sm py-2">
            {loading ? 'Salvataggio...' : 'Crea alert'}
          </button>
        </form>
      )}

      {/* Lista alert */}
      {priceAlerts.length === 0 ? (
        <div className="text-center py-10">
          <Bell className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Nessun alert configurato</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Crea un alert per sapere quando un prodotto scende sotto il prezzo che scegli
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {priceAlerts.map((alert) => {
            const best = getBestPrice(alert.product_name);
            const isTriggered = best.price <= alert.target_price;
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isTriggered
                    ? 'border-primary-200 bg-primary-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${isTriggered ? 'bg-primary-100' : 'bg-purple-100'}`}>
                  {isTriggered
                    ? <TrendingDown className="h-4 w-4 text-primary-600" />
                    : <Bell className="h-4 w-4 text-purple-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{alert.product_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Target: <strong>€{Number(alert.target_price).toFixed(2)}</strong>
                    {isTriggered ? (
                      <span className="text-primary-700 font-semibold ml-2">
                        ✓ Trovato a €{best.price.toFixed(2)} da {best.store}
                      </span>
                    ) : (
                      <span className="text-gray-400 ml-2">
                        Miglior prezzo: €{best.price.toFixed(2)} ({best.store})
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(alert.id, alert.product_name)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        * Prezzi indicativi basati su medie di mercato. Verifica sempre in negozio.
      </p>
    </div>
  );
}
