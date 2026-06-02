// ============================================================
// tsp.js — Algoritmo del Commesso Viaggiatore (TSP)
//
// Implementa una soluzione euristica nearest-neighbor + 2-opt
// per trovare il percorso ottimale tra più supermercati.
// Per N ≤ 10 negozi usa forza bruta; per N > 10 usa nearest-neighbor.
//
// Input: matrice delle distanze NxN e punto di partenza (casa utente)
// Output: ordine ottimale dei negozi da visitare
// ============================================================

/**
 * Risolve il TSP con algoritmo nearest-neighbor (euristica greedy)
 * Complessità: O(n²) — molto veloce per ≤ 20 negozi
 *
 * @param {number[][]} distMatrix - Matrice simmetrica delle distanze km[i][j]
 * @param {number}     startIdx  - Indice del punto di partenza (casa = 0)
 * @returns {{ route: number[], totalKm: number }}
 */
export function nearestNeighborTSP(distMatrix, startIdx = 0) {
  const n = distMatrix.length;
  if (n === 0) return { route: [], totalKm: 0 };
  if (n === 1) return { route: [0], totalKm: 0 };

  const visited = new Array(n).fill(false);
  const route = [startIdx];
  visited[startIdx] = true;

  let totalKm = 0;
  let current = startIdx;

  for (let step = 0; step < n - 1; step++) {
    let nearest = -1;
    let minDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && distMatrix[current][j] < minDist) {
        minDist = distMatrix[current][j];
        nearest = j;
      }
    }

    if (nearest === -1) break;
    visited[nearest] = true;
    route.push(nearest);
    totalKm += minDist;
    current = nearest;
  }

  // Ritorno al punto di partenza (ciclo chiuso)
  totalKm += distMatrix[current][startIdx];

  return { route, totalKm };
}

/**
 * Ottimizzazione 2-opt: migliora il percorso scambiando segmenti
 * Riduce la distanza totale eliminando incroci nel percorso
 *
 * @param {number[]}   route      - Percorso iniziale
 * @param {number[][]} distMatrix - Matrice delle distanze
 * @returns {{ route: number[], totalKm: number }}
 */
export function twoOptImprove(route, distMatrix) {
  let improved = true;
  let bestRoute = [...route];
  let bestDistance = calcRouteDistance(bestRoute, distMatrix);
  let iterations = 0;

  while (improved) {
    improved = false;
    if (++iterations > 500) break;
    for (let i = 1; i < bestRoute.length - 1; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        // Inverti il segmento tra i e j
        const newRoute = twoOptSwap(bestRoute, i, j);
        const newDist = calcRouteDistance(newRoute, distMatrix);
        if (newDist < bestDistance - 0.001) { // tolleranza floating point
          bestRoute = newRoute;
          bestDistance = newDist;
          improved = true;
        }
      }
    }
  }

  return { route: bestRoute, totalKm: bestDistance };
}

/**
 * Esegue lo swap 2-opt invertendo il sotto-percorso tra i e j
 */
function twoOptSwap(route, i, j) {
  const newRoute = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
  return newRoute;
}

/**
 * Calcola la distanza totale di un percorso (senza ritorno)
 */
function calcRouteDistance(route, distMatrix) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += distMatrix[route[i]][route[i + 1]];
  }
  return total;
}

/**
 * Algoritmo principale TSP con nearest-neighbor + 2-opt
 * Punto di partenza = indice 0 (posizione utente)
 *
 * @param {Object[]} locations - Array di { id, name, lat, lng, ... }
 * @param {number[][]} distMatrix - Matrice delle distanze (include posizione utente come idx 0)
 * @returns {{ orderedLocations: Object[], totalKm: number, route: number[] }}
 */
export function solveTSP(locations, distMatrix) {
  if (!locations || locations.length === 0) {
    return { orderedLocations: [], totalKm: 0, route: [] };
  }
  if (locations.length === 1) {
    return { orderedLocations: locations, totalKm: distMatrix[0][1] + distMatrix[1][0], route: [0, 1] };
  }

  // Fase 1: nearest-neighbor per ottenere un percorso iniziale
  const { route: initialRoute } = nearestNeighborTSP(distMatrix, 0);

  // Fase 2: 2-opt per migliorare il percorso
  const { route: optimizedRoute, totalKm } = twoOptImprove(initialRoute, distMatrix);

  // Rimuovi l'indice 0 (posizione utente) per ottenere solo i supermercati
  const supermarketRoute = optimizedRoute.filter((idx) => idx !== 0);

  // Riordina le location secondo il percorso ottimizzato
  const orderedLocations = supermarketRoute.map((idx) => locations[idx - 1]); // -1 perché idx 0 = casa

  return {
    orderedLocations,
    totalKm: Math.round(totalKm * 10) / 10,
    route: optimizedRoute,
  };
}

/**
 * Costruisce una matrice delle distanze da una risposta della Distance Matrix API di Google
 * La casa dell'utente è sempre in posizione 0
 *
 * @param {Object} googleMatrixResponse - Risposta grezza dell'API
 * @param {number} n                    - Numero totale di punti (casa + supermercati)
 * @returns {number[][]}
 */
export function buildDistanceMatrix(googleMatrixResponse, n) {
  const matrix = Array.from({ length: n }, () => new Array(n).fill(Infinity));

  // Diagonale = 0
  for (let i = 0; i < n; i++) matrix[i][i] = 0;

  const rows = googleMatrixResponse?.rows || [];
  rows.forEach((row, i) => {
    row.elements.forEach((el, j) => {
      if (el.status === 'OK') {
        const km = el.distance.value / 1000; // converti metri in km
        matrix[i][j] = km;
      }
    });
  });

  return matrix;
}

/**
 * Costruisce la matrice delle distanze da dati semplificati (lat/lng)
 * Usa la formula di Haversine come approssimazione quando l'API non è disponibile
 *
 * @param {Object[]} points - Array di { lat, lng }
 * @returns {number[][]}
 */
export function buildHaversineMatrix(points) {
  const n = points.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = haversineKm(points[i], points[j]);
      }
    }
  }
  return matrix;
}

/**
 * Calcola la distanza in km tra due coordinate usando la formula di Haversine
 */
export function haversineKm(a, b) {
  const R = 6371; // raggio terrestre in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}
