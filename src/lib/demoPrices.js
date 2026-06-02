// Prezzi demo per quando Firestore/scraping non è disponibile
export const DEMO_PRICES = {
  'Pasta':      { min: 0.89, max: 1.59 },
  'Latte':      { min: 1.19, max: 1.89 },
  'Pane':       { min: 1.29, max: 2.49 },
  'Uova':       { min: 2.49, max: 3.89 },
  'Caffè':      { min: 2.99, max: 4.49 },
  'Detersivo':  { min: 3.49, max: 5.99 },
  default:      { min: 1.00, max: 3.00 },
};

export function getDemoPrice(productName, supermarketIndex) {
  const name  = (productName || '').trim();
  const range = DEMO_PRICES[name] || DEMO_PRICES.default;
  const seed  = (name.length + supermarketIndex * 7) % 10;
  return range.min + (seed / 10) * (range.max - range.min);
}
