// ============================================================
// ProductItem — Riga singola della lista della spesa
// ============================================================
import { useState, useRef } from 'react';
import { Trash2, Package, ChevronDown, ChevronUp, Bell, Check, Minus, Plus, Pencil } from 'lucide-react';
import { useShopping } from '../../contexts/ShoppingContext';
import toast from 'react-hot-toast';

const CATEGORY_COLORS = {
  frutta_verdura:  'bg-green-100 text-green-800',
  carne_pesce:     'bg-red-100 text-red-800',
  latticini:       'bg-yellow-100 text-yellow-800',
  pane_pasticceria:'bg-amber-100 text-amber-800',
  pasta_riso:      'bg-orange-100 text-orange-800',
  bevande:         'bg-blue-100 text-blue-800',
  snack:           'bg-pink-100 text-pink-800',
  surgelati:       'bg-cyan-100 text-cyan-800',
  pulizia:         'bg-purple-100 text-purple-800',
  cura_persona:    'bg-rose-100 text-rose-800',
  altro:           'bg-gray-100 text-gray-700',
};

const CATEGORY_LABELS = {
  frutta_verdura:  'Frutta & Verdura',
  carne_pesce:     'Carne & Pesce',
  latticini:       'Latticini',
  pane_pasticceria:'Pane',
  pasta_riso:      'Pasta & Riso',
  bevande:         'Bevande',
  snack:           'Snack',
  surgelati:       'Surgelati',
  pulizia:         'Pulizia',
  cura_persona:    'Persona',
  altro:           'Altro',
};

export default function ProductItem({ item }) {
  const { toggleItem, removeItem, updateItem } = useShopping();
  const [expanded, setExpanded]             = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [togglingScorta, setTogglingScorta] = useState(false);
  const [updatingQty, setUpdatingQty]       = useState(false);
  const [editingName, setEditingName]       = useState(false);
  const [nameValue, setNameValue]           = useState(item.name);
  const nameInputRef                        = useRef(null);

  async function handleToggle() {
    try {
      await toggleItem(item.id);
    } catch {
      toast.error('Errore durante l\'aggiornamento');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeItem(item.id);
      toast.success(`"${item.name}" rimosso`);
    } catch {
      toast.error('Errore durante la rimozione');
      setDeleting(false);
    }
  }

  async function handleToggleStockable() {
    setTogglingScorta(true);
    try {
      await updateItem(item.id, { is_stockable: !item.is_stockable });
      toast.success(item.is_stockable ? 'Rimosso dalla scorta' : 'Aggiunto alla scorta');
    } catch {
      toast.error('Errore durante l\'aggiornamento');
    } finally {
      setTogglingScorta(false);
    }
  }

  async function handleQtyChange(delta) {
    const newQty = Math.max(0.5, (item.quantity || 1) + delta);
    setUpdatingQty(true);
    try {
      await updateItem(item.id, { quantity: newQty });
    } catch {
      toast.error('Errore aggiornamento quantità');
    } finally {
      setUpdatingQty(false);
    }
  }

  function startEditName() {
    setNameValue(item.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function commitEditName() {
    const trimmed = nameValue.trim();
    if (!trimmed) { setNameValue(item.name); setEditingName(false); return; }
    if (trimmed === item.name) { setEditingName(false); return; }
    try {
      await updateItem(item.id, { name: trimmed });
      toast.success('Nome aggiornato');
    } catch {
      toast.error('Errore durante il salvataggio');
      setNameValue(item.name);
    } finally {
      setEditingName(false);
    }
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { setNameValue(item.name); setEditingName(false); }
  }

  return (
    <div className={`flex flex-col border rounded-xl transition-all duration-200 ${
      item.checked ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'
    }`}>
      {/* Riga principale */}
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
            item.checked
              ? 'bg-primary-600 border-primary-600'
              : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          {item.checked && <Check className="h-3 w-3 text-white stroke-[3]" />}
        </button>

        {/* Info prodotto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Nome — cliccabile per modificarlo */}
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitEditName}
                onKeyDown={handleNameKeyDown}
                className="text-sm font-medium text-gray-900 border-b border-primary-400 bg-transparent outline-none w-full max-w-[200px]"
                autoFocus
              />
            ) : (
              <button
                onClick={!item.checked ? startEditName : undefined}
                title={!item.checked ? 'Clicca per modificare il nome' : undefined}
                className={`text-sm font-medium text-left truncate ${
                  item.checked
                    ? 'line-through text-gray-400 cursor-default'
                    : 'text-gray-900 hover:text-primary-700 group'
                }`}
              >
                {item.name}
                {!item.checked && (
                  <Pencil className="inline h-3 w-3 ml-1 text-gray-300 group-hover:text-primary-400 transition-colors" />
                )}
              </button>
            )}
            {item.is_stockable && (
              <span className="badge-orange flex-shrink-0">
                <Package className="h-3 w-3" />
                Scorta
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {item.category && (
              <span className={`badge text-xs flex-shrink-0 ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.altro}`}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
            )}
          </div>
        </div>

        {/* Stepper quantità */}
        {!item.checked && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-0.5">
            <button
              onClick={() => handleQtyChange(-0.5)}
              disabled={updatingQty || item.quantity <= 0.5}
              className="h-6 w-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs font-semibold text-gray-700 min-w-[2rem] text-center">
              {item.quantity} {item.unit}
            </span>
            <button
              onClick={() => handleQtyChange(0.5)}
              disabled={updatingQty}
              className="h-6 w-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Azioni */}
        <div className="flex items-center gap-1">
          {/* Toggle scorta */}
          <button
            onClick={handleToggleStockable}
            disabled={togglingScorta}
            title={item.is_stockable ? 'Rimuovi dalla scorta' : 'Aggiungi alla scorta'}
            className={`p-1.5 rounded-lg transition-colors ${
              item.is_stockable
                ? 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
            }`}
          >
            <Package className="h-4 w-4" />
          </button>

          {item.target_price && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dettagli espansi (prezzo target) */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-orange-50 rounded-b-xl">
          {item.target_price && (
            <div className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-orange-500" />
              <span className="text-gray-600">
                Notifica quando il prezzo scende sotto{' '}
                <strong className="text-orange-600">€{item.target_price.toFixed(2)}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
