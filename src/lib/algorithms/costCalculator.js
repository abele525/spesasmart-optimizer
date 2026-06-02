// ============================================================
// costCalculator.js — Calcolo del Costo Reale
//
// Formula ufficiale dalla specifica:
// Costo_Reale = Somma_Prezzi + ((Km_Totali * Consumo_Veicolo * Prezzo_Carburante) / 100)
//
// Dove Consumo_Veicolo è in L/100km e Prezzo_Carburante in €/L
// ============================================================

/**
 * Calcola il costo del carburante per un dato percorso
 * @param {number} kmTotali       - Distanza totale in km
 * @param {number} consumoMedio   - Consumo del veicolo in L/100km
 * @param {number} prezzoCarburante - Prezzo carburante in €/L
 * @returns {number} Costo carburante in Euro
 */
export function calcolaCostoCarburante(kmTotali, consumoMedio, prezzoCarburante) {
  if (!kmTotali || kmTotali <= 0) return 0;
  return (kmTotali * consumoMedio * prezzoCarburante) / 100;
}

/**
 * Calcola il Costo Reale totale della spesa
 * @param {number} sommaPrezzi    - Totale prodotti in Euro
 * @param {number} kmTotali       - Km percorsi totali
 * @param {Object} veicolo        - { consumo_medio, prezzo_carburante_rif }
 * @returns {Object} { costoReale, costoCarburante, sommaPrezzi }
 */
export function calcolaCostoReale(sommaPrezzi, kmTotali, veicolo) {
  const { consumo_medio = 7.0, prezzo_carburante_rif = 1.85 } = veicolo || {};
  const costoCarburante = calcolaCostoCarburante(kmTotali, consumo_medio, prezzo_carburante_rif);
  const costoReale = sommaPrezzi + costoCarburante;

  return {
    costoReale: Math.round(costoReale * 100) / 100,
    costoCarburante: Math.round(costoCarburante * 100) / 100,
    sommaPrezzi: Math.round(sommaPrezzi * 100) / 100,
  };
}

/**
 * Calcola il risparmio netto tra due scenari di acquisto
 * @param {Object} scenarioA - { costoReale, label }
 * @param {Object} scenarioB - { costoReale, label }
 * @returns {Object} { risparmio, percentuale, migliore }
 */
export function calcolaRisparmio(scenarioA, scenarioB) {
  const risparmio = Math.abs(scenarioA.costoReale - scenarioB.costoReale);
  const base = Math.max(scenarioA.costoReale, scenarioB.costoReale);
  const percentuale = base > 0 ? (risparmio / base) * 100 : 0;
  const migliore = scenarioA.costoReale <= scenarioB.costoReale ? scenarioA : scenarioB;

  return {
    risparmio: Math.round(risparmio * 100) / 100,
    percentuale: Math.round(percentuale * 10) / 10,
    migliore,
  };
}

/**
 * Calcola il costo reale considerando il traffico
 * Il traffico aumenta il consumo proporzionalmente al tempo extra
 * @param {number} kmTotali
 * @param {number} durataMinuti    - Durata stimata con traffico
 * @param {number} durataMinutiBase - Durata senza traffico
 * @param {Object} veicolo
 * @returns {Object}
 */
export function calcolaCostoConTraffico(sommaPrezzi, kmTotali, durataMinuti, durataMinutiBase, veicolo) {
  const { consumo_medio = 7.0, prezzo_carburante_rif = 1.85 } = veicolo || {};

  // Il traffico aumenta il consumo: in coda si consuma più carburante
  // Fattore di correzione basato sul rapporto tempo/km (velocità media)
  const velocitaMedia = durataMinutiBase > 0 ? (kmTotali / durataMinutiBase) * 60 : 60;
  const velocitaReale = durataMinuti > 0 ? (kmTotali / durataMinuti) * 60 : velocitaMedia;

  // Consumo aumenta quando la velocità è inferiore all'ottimale (~90 km/h)
  let fattoreTraffico = 1.0;
  if (velocitaReale < 30) fattoreTraffico = 1.35;       // Traffico intenso
  else if (velocitaReale < 50) fattoreTraffico = 1.20;  // Traffico moderato
  else if (velocitaReale < 70) fattoreTraffico = 1.10;  // Traffico leggero
  else fattoreTraffico = 1.0;                            // Libero

  const consumoCorretto = consumo_medio * fattoreTraffico;
  const costoCarburante = (kmTotali * consumoCorretto * prezzo_carburante_rif) / 100;
  const costoReale = sommaPrezzi + costoCarburante;

  return {
    costoReale: Math.round(costoReale * 100) / 100,
    costoCarburante: Math.round(costoCarburante * 100) / 100,
    sommaPrezzi: Math.round(sommaPrezzi * 100) / 100,
    fattoreTraffico,
    velocitaMedia: Math.round(velocitaReale),
  };
}

/**
 * Determina il livello di traffico da una durata
 * @param {number} durataConTraffico - Durata in secondi (da Google Maps)
 * @param {number} durataBase        - Durata senza traffico in secondi
 * @returns {string} 'basso' | 'medio' | 'alto' | 'critico'
 */
export function livelloTraffico(durataConTraffico, durataBase) {
  if (!durataBase || durataBase === 0) return 'basso';
  const ratio = durataConTraffico / durataBase;
  if (ratio < 1.1) return 'basso';
  if (ratio < 1.3) return 'medio';
  if (ratio < 1.6) return 'alto';
  return 'critico';
}

/**
 * Formatta un valore in Euro
 * @param {number} value
 * @returns {string}
 */
export function formatEuro(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}
