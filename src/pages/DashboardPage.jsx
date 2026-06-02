// ============================================================
// DashboardPage — Home principale dell'app dopo il login
// Mostra riepilogo lista, ultimo risparmio calcolato, alert
// ============================================================
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, TrendingDown, Bell, Users, MapPin, ChevronRight,
  Package, CheckCheck, Sparkles, Euro,
} from 'lucide-react';
import { useAuth }     from '../contexts/AuthContext';
import { useShopping } from '../contexts/ShoppingContext';
import { formatEuro }  from '../lib/algorithms/costCalculator';

export default function DashboardPage() {
  const { userProfile, currentUser } = useAuth();
  const { shoppingList, priceAlerts, optimizationResult } = useShopping();
  const navigate = useNavigate();

  const unchecked     = shoppingList.filter((i) => !i.checked);
  const checked       = shoppingList.filter((i) => i.checked);
  const stockables    = shoppingList.filter((i) => i.is_stockable);
  const activeAlerts  = priceAlerts.filter((a) => a.is_active);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buongiorno';
    if (h < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  const name = userProfile?.displayName || currentUser?.email?.split('@')[0] || 'Utente';

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Saluto */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {name}! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {unchecked.length === 0
            ? 'La lista è vuota. Pronto per fare la spesa?'
            : `Hai ${unchecked.length} prodott${unchecked.length === 1 ? 'o' : 'i'} da comprare.`}
        </p>
      </div>

      {/* Card ultimo risparmio */}
      {optimizationResult && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-5 text-white mb-6 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-100 text-sm mb-1">Ultimo risparmio calcolato</p>
              <p className="text-3xl font-bold">
                {optimizationResult.risparmio_netto > 0 ? '+' : ''}
                {formatEuro(optimizationResult.risparmio_netto || 0)}
              </p>
              <p className="text-primary-200 text-sm mt-1">
                Costo reale: {formatEuro(
                  optimizationResult.consiglia_multi
                    ? optimizationResult.scenario_ottimale?.costo_reale
                    : optimizationResult.scenario_singolo?.costo_reale
                )}
              </p>
            </div>
            <Sparkles className="h-10 w-10 text-primary-200 opacity-70" />
          </div>
          <button
            onClick={() => navigate('/ottimizza')}
            className="mt-4 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            Ricalcola <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grid statistiche */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={ShoppingCart}
          label="Da comprare"
          value={unchecked.length}
          color="primary"
          onClick={() => navigate('/lista')}
        />
        <StatCard
          icon={CheckCheck}
          label="Nel carrello"
          value={checked.length}
          color="gray"
          onClick={() => navigate('/lista')}
        />
        <StatCard
          icon={Package}
          label="Da scorta"
          value={stockables.length}
          color="orange"
          onClick={() => navigate('/lista', { state: { tab: 'scorta' } })}
        />
        <StatCard
          icon={Bell}
          label="Alert attivi"
          value={activeAlerts.length}
          color="purple"
          onClick={() => navigate('/lista', { state: { tab: 'alert' } })}
        />
      </div>

      {/* Azioni rapide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <QuickAction
          icon={ShoppingCart}
          title="Lista della Spesa"
          description="Aggiungi prodotti e gestisci la tua lista"
          onClick={() => navigate('/lista')}
          color="primary"
        />
        <QuickAction
          icon={TrendingDown}
          title="Ottimizza Percorso"
          description="Calcola il costo reale e il percorso migliore"
          onClick={() => navigate('/ottimizza')}
          color="green"
        />
        <QuickAction
          icon={MapPin}
          title="Mappa Supermercati"
          description="Visualizza i negozi vicini con traffico in tempo reale"
          onClick={() => navigate('/mappa')}
          color="blue"
        />
        <QuickAction
          icon={Users}
          title="Famiglia & Profilo"
          description="Gestisci il tuo veicolo e la sincronizzazione famiglia"
          onClick={() => navigate('/profilo')}
          color="purple"
        />
      </div>

      {/* Info CAP mancante */}
      {!userProfile?.cap_predefinito && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <MapPin className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Completa il tuo profilo</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Aggiungi il tuo CAP per trovare i supermercati vicini e ottimizzare i percorsi.
            </p>
            <button
              onClick={() => navigate('/profilo')}
              className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900"
            >
              Vai al profilo →
            </button>
          </div>
        </div>
      )}

      {/* Come funziona */}
      <div className="card mt-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Euro className="h-5 w-5 text-primary-600" />
          Come calcola SpesaSmart
        </h2>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-700">
          <p className="mb-2 font-semibold text-primary-700">Formula Costo Reale:</p>
          <p>Costo Reale =</p>
          <p className="pl-4">Somma Prezzi Prodotti</p>
          <p className="pl-4">+ (Km Totali × Consumo Veicolo × Prezzo Carburante) / 100</p>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Il sistema calcola automaticamente se conviene visitare più supermercati o uno solo,
          tenendo conto del traffico in tempo reale tramite Google Maps.
        </p>
      </div>
    </div>
  );
}

// Card statistica
function StatCard({ icon: Icon, label, value, color, onClick }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    gray:    'bg-gray-100 text-gray-600',
    orange:  'bg-orange-50 text-orange-600',
    purple:  'bg-purple-50 text-purple-600',
  };

  return (
    <button
      onClick={onClick}
      className="card-hover text-left p-4 cursor-pointer disabled:cursor-default"
      disabled={!onClick}
    >
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </button>
  );
}

// Card azione rapida
function QuickAction({ icon: Icon, title, description, onClick, color }) {
  const colors = {
    primary: 'bg-primary-600',
    green:   'bg-emerald-500',
    blue:    'bg-blue-500',
    purple:  'bg-purple-500',
  };

  return (
    <button
      onClick={onClick}
      className="card-hover text-left flex items-start gap-4 p-4 group"
    >
      <div className={`p-2.5 rounded-xl ${colors[color]} text-white flex-shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
          {title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-400 transition-colors flex-shrink-0 mt-1" />
    </button>
  );
}
