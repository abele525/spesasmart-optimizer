// Pagina mappa — mostra MapView con pannello info
import MapView from '../components/Map/MapView';
import { MapPin } from 'lucide-react';
import { useShopping } from '../contexts/ShoppingContext';

export default function MapPage() {
  const { optimizationResult } = useShopping();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="section-title flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary-600" />
          Mappa Supermercati
        </h1>
        <p className="section-subtitle">
          Visualizza il percorso ottimizzato con traffico in tempo reale
        </p>
      </div>

      {/* Mappa */}
      <MapView />

      {/* Info percorso (se disponibile) */}
      {optimizationResult?.ordered_route?.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-semibold text-gray-900 mb-2">Tappe del percorso</h3>
          <div className="flex flex-wrap gap-2">
            {optimizationResult.ordered_route.map((store, i) => (
              <span key={i} className="badge-green">
                {i + 1}. {store.insegna}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Percorso totale: ~{optimizationResult.total_km} km
          </p>
        </div>
      )}
    </div>
  );
}
