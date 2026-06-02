// ============================================================
// maps.js — Utilità per Google Maps Platform
// Wrapper per Distance Matrix API e Directions API
// ============================================================

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Converte un CAP italiano in coordinate geografiche (geocoding)
 * @param {string} cap - Codice Postale (es. "20100")
 * @returns {Promise<{lat: number, lng: number}>}
 */
export async function capToCoordinates(cap) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${cap},Italy&key=${MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results.length) {
    throw new Error(`Impossibile trovare il CAP: ${cap}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

/**
 * Chiama la Distance Matrix API di Google Maps per ottenere
 * distanze e durate tra più punti (incluso il traffico)
 *
 * @param {Object}   origin      - { lat, lng } della posizione utente
 * @param {Object[]} destinations - Array di { lat, lng } dei supermercati
 * @returns {Promise<Object>} - Risposta grezza della Distance Matrix API
 */
export async function getDistanceMatrix(origin, destinations) {
  // Usa il servizio client-side di Google Maps (già caricato nel browser)
  return new Promise((resolve, reject) => {
    if (!window.google?.maps?.DistanceMatrixService) {
      reject(new Error('Google Maps SDK non caricato'));
      return;
    }

    const service = new window.google.maps.DistanceMatrixService();

    const allPoints = [origin, ...destinations];

    service.getDistanceMatrix(
      {
        origins:      allPoints.map((p) => new window.google.maps.LatLng(p.lat, p.lng)),
        destinations: allPoints.map((p) => new window.google.maps.LatLng(p.lat, p.lng)),
        travelMode:   window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),                                        // Traffico real-time
          trafficModel:  window.google.maps.TrafficModel.BEST_GUESS,
        },
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status === 'OK') {
          resolve(response);
        } else {
          reject(new Error(`Distance Matrix API error: ${status}`));
        }
      }
    );
  });
}

/**
 * Calcola il percorso ottimizzato con Google Directions API
 * (include waypoints per il multi-stop)
 *
 * @param {Object}   origin      - { lat, lng }
 * @param {Object}   destination - { lat, lng } (ultimo negozio)
 * @param {Object[]} waypoints   - Array di { lat, lng } (negozi intermedi)
 * @returns {Promise<Object>} - Risposta Directions API con polyline e step
 */
export async function getOptimizedRoute(origin, destination, waypoints = []) {
  return new Promise((resolve, reject) => {
    if (!window.google?.maps?.DirectionsService) {
      reject(new Error('Google Maps SDK non caricato'));
      return;
    }

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints.map((wp) => ({
          location: new window.google.maps.LatLng(wp.lat, wp.lng),
          stopover: true,
        })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
        },
        optimizeWaypoints: false, // Usiamo il nostro TSP, non quello di Google
      },
      (result, status) => {
        if (status === 'OK') {
          resolve(result);
        } else {
          reject(new Error(`Directions API error: ${status}`));
        }
      }
    );
  });
}

/**
 * Estrae km totali e durata (con traffico) da una risposta Directions API
 * @param {Object} directionsResult
 * @returns {{ km: number, durataMin: number, durataBaseMin: number }}
 */
export function extractRouteInfo(directionsResult) {
  const legs = directionsResult?.routes?.[0]?.legs || [];
  let totalMeters = 0;
  let totalSeconds = 0;
  let totalSecondsBase = 0;

  legs.forEach((leg) => {
    totalMeters  += leg.distance?.value || 0;
    totalSeconds += leg.duration_in_traffic?.value || leg.duration?.value || 0;
    totalSecondsBase += leg.duration?.value || 0;
  });

  return {
    km:           Math.round((totalMeters / 1000) * 10) / 10,
    durataMin:    Math.round(totalSeconds / 60),
    durataBaseMin: Math.round(totalSecondsBase / 60),
  };
}

/**
 * Cerca supermercati vicini tramite Places API nel raggio specificato
 * @param {Object} center - { lat, lng }
 * @param {number} radiusKm - Raggio di ricerca in km
 * @returns {Promise<Object[]>} - Array di luoghi trovati
 */
export async function searchNearbySupermarkets(center, radiusKm = 20) {
  return new Promise((resolve, reject) => {
    if (!window.google?.maps?.places?.PlacesService) {
      reject(new Error('Google Maps Places API non caricata'));
      return;
    }

    // PlacesService richiede un elemento DOM o una mappa
    const mapDiv = document.createElement('div');
    const map = new window.google.maps.Map(mapDiv);
    const service = new window.google.maps.places.PlacesService(map);

    // Usa rankBy DISTANCE per ordinare per distanza (richiede keyword, non radius)
    service.nearbySearch(
      {
        location: new window.google.maps.LatLng(center.lat, center.lng),
        rankBy: window.google.maps.places.RankBy.DISTANCE, // ordina per distanza reale
        keyword: 'supermercato coop esselunga lidl conad carrefour penny eurospin',
      },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          // Filtra solo i risultati entro il raggio specificato usando Haversine
          const filtered = results.filter((place) => {
            const lat2 = place.geometry.location.lat();
            const lng2 = place.geometry.location.lng();
            const R = 6371;
            const dLat = (lat2 - center.lat) * Math.PI / 180;
            const dLng = (lng2 - center.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(center.lat * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
            const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return distKm <= radiusKm;
          });

          const supermarkets = filtered.map((place) => ({
            sid: place.place_id,
            insegna: place.name,
            coordinate: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            },
            address: place.vicinity,
            rating: place.rating,
            open_now: place.opening_hours?.isOpen() || null,
          }));
          resolve(supermarkets);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`Places API error: ${status}`));
        }
      }
    );
  });
}
