// ============================================================
// PriceTable — Tabella confronto prezzi per prodotto × negozio
// Evidenzia il prezzo più basso per ogni prodotto
// ============================================================
import { Fragment } from 'react';
import { Euro, TrendingDown, Info } from 'lucide-react';

/**
 * Specifiche di riferimento per prodotti generici (senza marca/formato).
 * Chiave: nome prodotto in minuscolo (parziale match).
 * Valore: stringa descrittiva mostrata come nota sotto al prezzo.
 */
const GENERIC_SPECS = {
  // Latticini
  'latte':        '1 L · UHT intero · marca insegna',
  'burro':        '250 g · marca insegna',
  'mozzarella':   '125 g · fior di latte',
  'formaggio':    '300 g · fette miste · marca insegna',
  'yogurt':       '125 g · bianco intero · marca insegna',
  'panna':        '200 ml · da cucina · marca insegna',
  'uova':         'conf. 6 uova · cat. A · medie',
  // Pane e pasta
  'pasta':        '500 g · spaghetti n°5 · marca insegna',
  'riso':         '1 kg · parboiled · marca insegna',
  'farina':       '1 kg · tipo 00 · marca insegna',
  'pane':         '400 g · pane di casa · a fette',
  'grissini':     '250 g · classici',
  'biscotti':     '400 g · frollini · marca insegna',
  // Condimenti e conserve
  'olio':         '1 L · olio di semi di girasole',
  'olio d\'oliva':'750 ml · extravergine · marca insegna',
  'zucchero':     '1 kg · semolato · marca insegna',
  'sale':         '1 kg · fino · iodato',
  'passata':      '700 g · passata di pomodoro · marca insegna',
  'pomodori':     '400 g · pelati · marca insegna',
  'aceto':        '500 ml · di vino bianco · marca insegna',
  'tonno':        '80 g · in olio · sott\'olio · marca insegna',
  // Bevande
  'acqua':        '1,5 L · naturale · marca insegna',
  'succo':        '1 L · succo di frutta · marca insegna',
  'aranciata':    '1,5 L · marca insegna',
  'birra':        '33 cl · lager · marca insegna',
  'vino':         '75 cl · rosso da tavola · marca insegna',
  // Carne e pesce
  'pollo':        '1 kg · petto · fresco · sfuso',
  'macinato':     '500 g · macinato misto · fresco',
  'prosciutto':   '100 g · cotto · affettato · marca insegna',
  'salame':       '100 g · tipo Milano · affettato',
  'salmone':      '150 g · filetto · surgelato',
  // Pulizia e cura
  'detersivo':    '1 L · liquido per piatti · marca insegna',
  'ammorbidente': '1 L · classico · marca insegna',
  'sapone':       '500 ml · sapone liquido mani · marca insegna',
  'shampoo':      '250 ml · capelli normali · marca insegna',
  'dentifricio':  '75 ml · menta classica · marca insegna',
  'carta':        '6 rotoli · igienica 2 veli · marca insegna',
  'fazzoletti':   'conf. 10 × 10 · 2 veli',
  // Snack e dolci
  'caffè':        '250 g · miscela classica · macinato · marca insegna',
  'cioccolato':   '100 g · fondente 70% · marca insegna',
  'miele':        '500 g · millefiori · marca insegna',
  'marmellata':   '350 g · albicocca · marca insegna',
  'nutella':      '400 g · crema alle nocciole',
};

/**
 * Restituisce la specifica di riferimento per un prodotto generico,
 * oppure null se il prodotto sembra già specifico (ha numeri, grammature, marche).
 */
function getProductSpec(productName) {
  if (!productName) return null;
  const name = productName.toLowerCase().trim();

  // Se il nome contiene già numeri (grammature, volumi) o simboli tipici
  // di una referenza specifica, non aggiungere la specifica
  const hasQuantity = /\d/.test(productName);          // es. "Latte 1L"
  const hasParenthesis = /\(/.test(productName);        // es. "Pasta (barilla)"
  if (hasQuantity || hasParenthesis) return null;

  // Cerca corrispondenza esatta o parziale nel dizionario
  if (GENERIC_SPECS[name]) return GENERIC_SPECS[name];

  // Match parziale: trova la chiave più lunga che il nome contiene,
  // ma solo se non ci sono parole aggiuntive significative (es. marchi).
  let bestMatch = null;
  let bestLen = 0;
  for (const [key, spec] of Object.entries(GENERIC_SPECS)) {
    if (name.includes(key) && key.length > bestLen) {
      // Controlla se, tolto il match, rimane una parola di 3+ caratteri
      // (indicatore di marca o descrittore specifico → prodotto non generico)
      const remaining = name.replace(key, '').trim();
      const hasExtraWord = /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(remaining);
      if (!hasExtraWord) {
        bestMatch = spec;
        bestLen = key.length;
      }
    }
  }
  return bestMatch;
}

const CATEGORY_LABELS = {
  frutta_verdura:  '🥦 Frutta & Verdura',
  carne_pesce:     '🥩 Carne & Pesce',
  latticini:       '🥛 Latticini & Uova',
  pane_pasticceria:'🍞 Pane & Pasticceria',
  pasta_riso:      '🍝 Pasta & Riso',
  bevande:         '🥤 Bevande',
  snack:           '🍫 Snack & Dolci',
  surgelati:       '🧊 Surgelati',
  pulizia:         '🧹 Pulizia Casa',
  cura_persona:    '💆 Cura Persona',
  altro:           '📦 Altro',
};

/**
 * Costruisce la struttura dati dei prezzi:
 * Per ogni prodotto, per ogni negozio, prezzo unitario e totale
 */
export function buildPriceData(items, stores, getDemoPrice) {
  return items.map((item) => {
    const prices = stores.map((store, idx) => {
      const unitPrice = getDemoPrice(item.name, idx);
      return {
        sid:       store.sid,
        insegna:   store.insegna,
        unitPrice,
        total:     unitPrice * (item.quantity || 1),
      };
    });
    const cheapest = prices.reduce((min, p) => p.unitPrice < min.unitPrice ? p : min, prices[0]);
    const mostExpensive = prices.reduce((max, p) => p.unitPrice > max.unitPrice ? p : max, prices[0]);
    const savingPerItem = mostExpensive.unitPrice - cheapest.unitPrice;
    return { ...item, prices, cheapest, mostExpensive, savingPerItem };
  });
}

/**
 * Calcola totale per negozio e negozio più conveniente in assoluto
 */
export function computeStoreTotals(priceData, stores) {
  return stores.map((store, idx) => ({
    ...store,
    total: priceData.reduce((sum, row) => sum + row.prices[idx].total, 0),
  }));
}

export default function PriceTable({ priceData, stores }) {
  if (!priceData || priceData.length === 0 || stores.length === 0) return null;

  const storeTotals  = computeStoreTotals(priceData, stores);
  const cheapestStore = storeTotals.reduce((min, s) => s.total < min.total ? s : min, storeTotals[0]);
  const totalSaving   = storeTotals.reduce((max, s) => s.total > max.total ? s : max, storeTotals[0]).total - cheapestStore.total;

  // Raggruppa per categoria
  const byCategory = priceData.reduce((acc, row) => {
    const cat = row.category || 'altro';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {});

  return (
    <div className="card mb-4 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Euro className="h-4 w-4 text-primary-600" />
            Confronto prezzi per prodotto
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            I prezzi in verde sono i più convenienti per quel prodotto
          </p>
        </div>
        {totalSaving > 0.01 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-right flex-shrink-0 ml-4">
            <p className="text-xs text-gray-500">Risparmio potenziale</p>
            <p className="text-sm font-bold text-primary-700 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" />
              fino a €{totalSaving.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Tabella con scroll orizzontale */}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full min-w-max text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide sticky left-0 bg-gray-50 min-w-[160px]">
                Prodotto
              </th>
              {stores.map((store) => (
                <th
                  key={store.sid}
                  className={`text-center px-4 py-2.5 font-medium text-xs uppercase tracking-wide min-w-[110px] ${
                    store.sid === cheapestStore.sid
                      ? 'text-primary-700 bg-primary-50'
                      : 'text-gray-600'
                  }`}
                >
                  <div>{store.insegna}</div>
                  {store.sid === cheapestStore.sid && (
                    <div className="text-[10px] text-primary-500 font-normal normal-case mt-0.5">
                      ★ Più conveniente
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byCategory).map(([category, rows]) => (
              <Fragment key={category}>
                {/* Riga intestazione categoria */}
                <tr className="bg-gray-50/60">
                  <td
                    colSpan={stores.length + 1}
                    className="px-6 py-1.5 text-xs font-semibold text-gray-500 tracking-wide border-b border-gray-100 sticky left-0"
                  >
                    {CATEGORY_LABELS[category] || category}
                  </td>
                </tr>
                {/* Righe prodotti */}
                {rows.map((row) => {
                  const spec = getProductSpec(row.name);
                  return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-2.5 sticky left-0 bg-white">
                      <div className="font-medium text-gray-900 leading-tight">{row.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{row.quantity} {row.unit}</div>
                      {spec && (
                        <div className="flex items-start gap-1 mt-1">
                          <Info className="h-3 w-3 text-gray-300 flex-shrink-0 mt-0.5" />
                          <span className="text-[10px] text-gray-400 leading-tight italic">{spec}</span>
                        </div>
                      )}
                    </td>
                    {row.prices.map((p) => {
                      const isCheapest = p.sid === row.cheapest.sid;
                      const isExpensive = p.sid === row.mostExpensive.sid && stores.length > 1;
                      return (
                        <td
                          key={p.sid}
                          className={`text-center px-4 py-2.5 ${
                            isCheapest
                              ? 'bg-primary-50'
                              : isExpensive
                              ? 'bg-red-50/40'
                              : ''
                          }`}
                        >
                          <div className={`font-semibold text-sm ${
                            isCheapest ? 'text-primary-700' : isExpensive ? 'text-red-600' : 'text-gray-700'
                          }`}>
                            €{p.total.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            €{p.unitPrice.toFixed(2)}/pz
                          </div>
                          {isCheapest && stores.length > 1 && (
                            <div className="text-[10px] text-primary-600 font-medium">✓ best</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </Fragment>
            ))}

            {/* Riga totali */}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="px-6 py-3 text-sm text-gray-900 sticky left-0 bg-gray-50">
                Totale spesa
              </td>
              {storeTotals.map((store) => (
                <td
                  key={store.sid}
                  className={`text-center px-4 py-3 text-sm ${
                    store.sid === cheapestStore.sid
                      ? 'text-primary-700 bg-primary-100'
                      : 'text-gray-700'
                  }`}
                >
                  <div className="font-bold">€{store.total.toFixed(2)}</div>
                  {store.sid === cheapestStore.sid && (
                    <div className="text-xs text-primary-600 font-normal">Più basso</div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Nota prezzi */}
      <p className="text-xs text-gray-400 mt-3 px-0">
        * Prezzi indicativi basati su medie di mercato. Verifica sempre i prezzi in negozio.
      </p>
    </div>
  );
}
