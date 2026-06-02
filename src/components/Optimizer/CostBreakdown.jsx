// ============================================================
// CostBreakdown — Dettaglio del calcolo del Costo Reale
// Mostra il breakdown: prezzo prodotti + costo carburante
// ============================================================
import { Euro, Fuel, TrendingDown, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatEuro, livelloTraffico } from '../../lib/algorithms/costCalculator';

// Badge livello traffico
function TrafficBadge({ livello }) {
  const config = {
    basso:   { label: 'Traffico scorrevole', cls: 'badge-green', icon: CheckCircle2 },
    medio:   { label: 'Traffico moderato',   cls: 'badge-orange', icon: AlertTriangle },
    alto:    { label: 'Traffico intenso',     cls: 'badge-red',    icon: AlertTriangle },
    critico: { label: 'Traffico critico',     cls: 'badge-red',    icon: AlertTriangle },
  };
  const { label, cls, icon: Icon } = config[livello] || config.basso;
  return (
    <span className={`badge ${cls} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export default function CostBreakdown({ result, veicolo }) {
  if (!result) return null;

  const {
    scenario_singolo,  // Supermercato più economico in assoluto
    scenario_ottimale, // Percorso TSP ottimizzato con più negozi
    risparmio_netto,   // risparmio_singolo - costo_extra_carburante
  } = result;

  const trafficLevel = livelloTraffico(
    scenario_ottimale?.durataMin * 60,
    scenario_ottimale?.durataBaseMin * 60
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header risparmio */}
      {risparmio_netto !== undefined && (
        <div className={`rounded-xl p-4 flex items-center gap-4 ${
          risparmio_netto > 0 ? 'bg-primary-50 border border-primary-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className={`rounded-full p-2 ${risparmio_netto > 0 ? 'bg-primary-100' : 'bg-red-100'}`}>
            <TrendingDown className={`h-6 w-6 ${risparmio_netto > 0 ? 'text-primary-600' : 'text-red-500'}`} />
          </div>
          <div>
            <p className="text-sm text-gray-600">Risparmio netto stimato</p>
            <p className={`text-2xl font-bold ${risparmio_netto > 0 ? 'text-primary-700' : 'text-red-600'}`}>
              {risparmio_netto > 0 ? '+' : ''}{formatEuro(risparmio_netto)}
            </p>
            <p className="text-xs text-gray-500">
              Già detratto il costo della benzina aggiuntiva
            </p>
          </div>
        </div>
      )}

      {/* Confronto scenari */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Scenario singolo supermercato */}
        {scenario_singolo && (
          <ScenarioCard
            title="Un solo negozio"
            subtitle={scenario_singolo.nome_supermercato || 'Supermercato migliore'}
            prezziProdotti={scenario_singolo.somma_prezzi}
            costoCarburante={scenario_singolo.costo_carburante}
            costoReale={scenario_singolo.costo_reale}
            km={scenario_singolo.km}
            durataMin={scenario_singolo.durata_min}
            highlight={!result.consiglia_multi}
          />
        )}

        {/* Scenario multi-supermercato */}
        {scenario_ottimale && (
          <ScenarioCard
            title="Percorso ottimizzato"
            subtitle={`${scenario_ottimale.supermercati?.length || 0} negozi · TSP`}
            prezziProdotti={scenario_ottimale.somma_prezzi}
            costoCarburante={scenario_ottimale.costo_carburante}
            costoReale={scenario_ottimale.costo_reale}
            km={scenario_ottimale.km}
            durataMin={scenario_ottimale.durata_min}
            traffico={trafficLevel}
            highlight={result.consiglia_multi}
          />
        )}
      </div>

      {/* Info veicolo */}
      {veicolo && (
        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 text-sm text-gray-600">
          <Fuel className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span>
            Calcolo basato su {veicolo.consumo_medio} L/100km ·{' '}
            {formatEuro(veicolo.prezzo_carburante_rif)}/L ({veicolo.tipo})
          </span>
        </div>
      )}
    </div>
  );
}

// Card singolo scenario
function ScenarioCard({ title, subtitle, prezziProdotti, costoCarburante, costoReale, km, durataMin, traffico, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight
        ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
        : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {highlight && (
          <span className="badge-green text-xs">Consigliato</span>
        )}
      </div>

      {/* Breakdown */}
      <div className="space-y-1.5 mb-3">
        <LineRow
          icon={<Euro className="h-3.5 w-3.5 text-gray-400" />}
          label="Prodotti"
          value={formatEuro(prezziProdotti)}
        />
        <LineRow
          icon={<Fuel className="h-3.5 w-3.5 text-orange-400" />}
          label="Carburante"
          value={formatEuro(costoCarburante)}
          sub
        />
        {km && (
          <LineRow
            icon={<span className="text-gray-400 text-xs">km</span>}
            label="Distanza"
            value={`${parseFloat(km).toFixed(1)} km`}
            sub
          />
        )}
        {durataMin && (
          <LineRow
            icon={<Clock className="h-3.5 w-3.5 text-gray-400" />}
            label="Tempo"
            value={`~${durataMin} min`}
            sub
          />
        )}
      </div>

      {/* Traffico */}
      {traffico && (
        <div className="mb-3">
          <TrafficBadge livello={traffico} />
        </div>
      )}

      {/* Totale */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Costo Reale</span>
          <span className={`text-lg font-bold ${highlight ? 'text-primary-700' : 'text-gray-900'}`}>
            {formatEuro(costoReale)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LineRow({ icon, label, value, sub = false }) {
  return (
    <div className={`flex items-center justify-between ${sub ? 'pl-2' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <span className="text-xs font-medium text-gray-700">{value}</span>
    </div>
  );
}
