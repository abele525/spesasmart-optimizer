// ============================================================
// AddProductModal — Modal per aggiungere un prodotto alla lista
// ============================================================
import { useState } from 'react';
import { X, Plus, Package, Bell, ScanLine } from 'lucide-react';
import { useShopping } from '../../contexts/ShoppingContext';
import BarcodeScanner from './BarcodeScanner';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'frutta_verdura', label: 'Frutta & Verdura' },
  { value: 'carne_pesce',    label: 'Carne & Pesce' },
  { value: 'latticini',      label: 'Latticini & Uova' },
  { value: 'pane_pasticceria', label: 'Pane & Pasticceria' },
  { value: 'pasta_riso',     label: 'Pasta & Riso' },
  { value: 'bevande',        label: 'Bevande' },
  { value: 'snack',          label: 'Snack & Dolci' },
  { value: 'surgelati',      label: 'Surgelati' },
  { value: 'pulizia',        label: 'Pulizia Casa' },
  { value: 'cura_persona',   label: 'Cura Persona' },
  { value: 'altro',          label: 'Altro' },
];

const UNITS = ['pz', 'kg', 'g', 'L', 'ml', 'conf', 'bott', 'scatola'];

export default function AddProductModal({ onClose }) {
  const { addItem } = useShopping();

  const [name, setName]           = useState('');
  const [quantity, setQuantity]   = useState(1);
  const [unit, setUnit]           = useState('pz');
  const [category, setCategory]   = useState('altro');
  const [isStockable, setIsStockable] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading]     = useState(false);
  const [scanning, setScanning]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Inserisci il nome del prodotto');

    setLoading(true);
    try {
      await addItem({
        name: name.trim(),
        quantity: Number(quantity),
        unit,
        category,
        is_stockable: isStockable,
        target_price: isStockable && targetPrice ? Number(targetPrice) : null,
      });
      toast.success(`"${name.trim()}" aggiunto alla lista`);
      onClose();
    } catch {
      toast.error('Errore nell\'aggiunta del prodotto');
    } finally {
      setLoading(false);
    }
  }

  function handleScanResult({ barcode, name: productName }) {
    setScanning(false);
    if (productName) {
      setName(productName);
      toast.success(`Prodotto trovato: ${productName}`);
    } else {
      toast(`Codice ${barcode} non trovato nel database — inserisci il nome manualmente`, { icon: '🔍' });
    }
  }

  return (
    <>
    {scanning && (
      <BarcodeScanner onDetected={handleScanResult} onClose={() => setScanning(false)} />
    )}
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-slide-up">
        {/* Header modal */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Aggiungi prodotto</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nome prodotto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome prodotto *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field flex-1"
                placeholder="es. Pasta, Latte, Caffè..."
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex-shrink-0 p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                title="Scansiona codice a barre"
              >
                <ScanLine className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Quantità e unità */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantità</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="input-field"
                min={1}
                step={0.5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unità</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="input-field"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Opzione Stockable */}
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isStockable}
                onChange={(e) => setIsStockable(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">Prodotto da scorta</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ricevi una notifica quando scende sotto il prezzo target
                </p>
              </div>
            </label>

            {isStockable && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <Bell className="inline h-3 w-3 mr-1" />
                  Prezzo target (€)
                </label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="input-field text-sm"
                  placeholder="es. 2.50"
                  min={0}
                  step={0.01}
                />
              </div>
            )}
          </div>

          {/* Pulsanti */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading
                ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full spinner" />
                : <Plus className="h-4 w-4" />}
              Aggiungi
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
