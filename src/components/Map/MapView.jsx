// ============================================================
// MapView — Mappa interattiva con Google Maps
// Mostra supermercati e percorso ottimizzato con traffico
// ============================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, TrafficLayer, InfoWindow } from '@react-google-maps/api';
import { MapPin, AlertCircle, Loader2, Navigation } from 'lucide-react';
import { useShopping } from '../../contexts/ShoppingContext';
import { useAuth } from '../../contexts/AuthContext';
import { getOptimizedRoute } from '../../lib/maps';

const MAPS_LIBRARIES = ['places'];

const MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const CONTAINER_STYLE = { width: '100%', height: '500px' };
const DEFAULT_CENTER  = { lat: 43.9167, lng: 11.0364 }; // Centro Italia (Firenze area)

// Geocodifica un indirizzo via Nominatim (gratuito, senza API key)
async function geocodeAddress(address) {
  const query = /^\d{5}$/.test(address.trim())
    ? `postalcode=${address.trim()}&country=Italy`
    : `q=${encodeURIComponent(address + ', Italy')}`;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${query}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'it' } }
  );
  const data = await res.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

export default function MapView() {
  const { optimizationResult }  = useShopping();
  const { userProfile }          = useAuth();

  const [center, setCenter]           = useState(DEFAULT_CENTER);
  const [directions, setDirections]   = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: MAPS_LIBRARIES,
  });

  // Centra la mappa sulla posizione dell'utente (usa coordinate salvate nel profilo)
  useEffect(() => {
    if (userProfile?.indirizzo_coords) {
      // Usa le coordinate già geocodificate salvate nel profilo
      setCenter(userProfile.indirizzo_coords);
    } else if (userProfile?.indirizzo || userProfile?.cap_predefinito) {
      // Fallback: geocodifica l'indirizzo/CAP
      const addr = userProfile.indirizzo || userProfile.cap_predefinito;
      geocodeAddress(addr)
        .then((coords) => { if (coords) setCenter(coords); })
        .catch(() => {});
    }
  }, [userProfile?.indirizzo_coords, userProfile?.indirizzo, userProfile?.cap_predefinito]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Quando arriva un risultato ottimizzazione, adatta la visualizzazione
  useEffect(() => {
    if (mapRef.current && optimizationResult?.ordered_route?.length > 0) {
      const stores = optimizationResult.ordered_route;
      // Calcola il centro come media delle coordinate dei negozi
      const avgLat = stores.reduce((s, st) => s + st.coordinate.lat, 0) / stores.length;
      const avgLng = stores.reduce((s, st) => s + st.coordinate.lng, 0) / stores.length;
      mapRef.current.panTo({ lat: avgLat, lng: avgLng });
      mapRef.current.setZoom(12);
    }
  }, [optimizationResult]);

  // Calcola e visualizza il percorso ottimizzato
  async function showRoute() {
    if (!optimizationResult?.ordered_route?.length) return;
    setRouteLoading(true);

    try {
      const route  = optimizationResult.ordered_route;
      const origin = center;
      const dest   = route[route.length - 1].coordinate;
      const waypts = route.slice(0, -1).map((s) => s.coordinate);

      const result = await getOptimizedRoute(origin, dest, waypts);
      setDirections(result);
    } catch {
      // In modalità demo il percorso reale non è disponibile
    } finally {
      setRouteLoading(false);
    }
  }

  const stores = optimizationResult?.ordered_route || [];
  const apiKey  = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Stato di caricamento
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-primary-600 spinner mx-auto mb-2" />
          <p className="text-sm text-gray-500">Caricamento mappa...</p>
        </div>
      </div>
    );
  }

  // Errore API Key
  if (loadError || !apiKey) {
    return (
      <div className="flex items-center justify-center h-80 bg-amber-50 rounded-xl border border-amber-200 p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Mappa non disponibile</h3>
          <p className="text-sm text-gray-600">
            Configura la variabile d'ambiente{' '}
            <code className="bg-white px-1 py-0.5 rounded text-amber-700 text-xs">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
            nel file <code className="bg-white px-1 py-0.5 rounded text-amber-700 text-xs">.env</code> per abilitare la mappa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controlli mappa */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showTraffic}
            onChange={(e) => setShowTraffic(e.target.checked)}
            className="h-4 w-4 rounded text-primary-600"
          />
          Mostra traffico in tempo reale
        </label>

        {stores.length > 0 && (
          <button
            onClick={showRoute}
            disabled={routeLoading}
            className="btn-primary text-sm flex items-center gap-2 py-1.5"
          >
            {routeLoading
              ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full spinner" />
              : <Navigation className="h-3.5 w-3.5" />}
            Mostra percorso ottimale
          </button>
        )}

        {directions && (
          <button
            onClick={() => setDirections(null)}
            className="btn-secondary text-sm py-1.5"
          >
            Nascondi percorso
          </button>
        )}
      </div>

      {/* Mappa Google */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <GoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={center}
          zoom={13}
          onLoad={onMapLoad}
          options={{
            styles: MAP_STYLE,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Layer traffico */}
          {showTraffic && <TrafficLayer />}

          {/* Marker casa utente */}
          <Marker
            position={center}
            icon={{
              url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png',
              scaledSize: new window.google.maps.Size(27, 43),
            }}
            title="La tua posizione"
          />

          {/* Marker supermercati */}
          {stores.map((store, idx) => (
            <Marker
              key={store.sid || idx}
              position={store.coordinate}
              label={{
                text: String(idx + 1),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
              title={store.insegna}
              onClick={() => setSelectedMarker(store)}
            />
          ))}

          {/* InfoWindow supermercato selezionato */}
          {selectedMarker && (
            <InfoWindow
              position={selectedMarker.coordinate}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1 min-w-[120px]">
                <p className="font-semibold text-gray-900">{selectedMarker.insegna}</p>
                {selectedMarker.address && (
                  <p className="text-xs text-gray-500 mt-0.5">{selectedMarker.address}</p>
                )}
                {selectedMarker.rating && (
                  <p className="text-xs text-amber-600 mt-0.5">★ {selectedMarker.rating}</p>
                )}
                {selectedMarker.open_now !== null && selectedMarker.open_now !== undefined && (
                  <p className={`text-xs mt-0.5 font-medium ${selectedMarker.open_now ? 'text-green-600' : 'text-red-500'}`}>
                    {selectedMarker.open_now ? '● Aperto' : '● Chiuso'}
                  </p>
                )}
              </div>
            </InfoWindow>
          )}

          {/* Percorso Directions */}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#16a34a',
                  strokeWeight: 5,
                  strokeOpacity: 0.8,
                },
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Legenda / stato vuoto */}
      {stores.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-500">
          <MapPin className="h-5 w-5 mx-auto mb-1 text-gray-300" />
          Esegui un'ottimizzazione per vedere i supermercati sulla mappa
        </div>
      )}

      {/* Lista negozi sotto la mappa */}
      {stores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {stores.map((store, idx) => (
            <button
              key={store.sid || idx}
              onClick={() => {
                setSelectedMarker(store);
                mapRef.current?.panTo(store.coordinate);
                mapRef.current?.setZoom(15);
              }}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
            >
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{store.insegna}</p>
                {store.address && <p className="text-xs text-gray-500 truncate">{store.address}</p>}
              </div>
              {store.rating && <span className="text-xs text-amber-600">★ {store.rating}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
