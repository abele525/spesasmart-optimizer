// ============================================================
// printReport.js — Generazione report PDF tramite window.print()
// Apre una finestra di stampa con layout ottimizzato per PDF
// ============================================================

function formatEuroPrint(value) {
  if (value === null || value === undefined) return '—';
  return `€${Number(value).toFixed(2).replace('.', ',')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CATEGORY_LABELS = {
  frutta_verdura:  'Frutta & Verdura',
  carne_pesce:     'Carne & Pesce',
  latticini:       'Latticini & Uova',
  pane_pasticceria:'Pane & Pasticceria',
  pasta_riso:      'Pasta & Riso',
  bevande:         'Bevande',
  snack:           'Snack & Dolci',
  surgelati:       'Surgelati',
  pulizia:         'Pulizia Casa',
  cura_persona:    'Cura Persona',
  altro:           'Altro',
};

/**
 * Genera la tabella HTML dei prezzi per negozio
 */
function buildPriceTableHTML(priceData, stores) {
  if (!priceData || priceData.length === 0 || stores.length === 0) return '';

  const storeTotals = stores.map((store, idx) => ({
    ...store,
    total: priceData.reduce((sum, row) => sum + row.prices[idx].total, 0),
  }));
  const cheapestSid = storeTotals.reduce((min, s) => s.total < min.total ? s : min, storeTotals[0]).sid;

  // Raggruppa per categoria
  const byCategory = priceData.reduce((acc, row) => {
    const cat = row.category || 'altro';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {});

  const headerCols = stores.map((s) => `
    <th style="text-align:center;padding:6px 10px;background:${s.sid === cheapestSid ? '#dcfce7' : '#f9fafb'};color:${s.sid === cheapestSid ? '#166534' : '#374151'};font-size:11px;border:1px solid #e5e7eb;">
      ${s.insegna}${s.sid === cheapestSid ? '<br><span style="font-weight:400;font-size:10px">★ Migliore</span>' : ''}
    </th>
  `).join('');

  let rows = '';
  for (const [cat, items] of Object.entries(byCategory)) {
    rows += `
      <tr>
        <td colspan="${stores.length + 1}" style="padding:5px 10px;background:#f3f4f6;font-size:10px;font-weight:600;color:#6b7280;border:1px solid #e5e7eb;">
          ${CATEGORY_LABELS[cat] || cat}
        </td>
      </tr>
    `;
    for (const row of items) {
      const priceCols = row.prices.map((p) => {
        const isBest = p.sid === row.cheapest.sid;
        return `
          <td style="text-align:center;padding:5px 10px;background:${isBest ? '#f0fdf4' : 'white'};color:${isBest ? '#15803d' : '#374151'};font-weight:${isBest ? '700' : '400'};border:1px solid #e5e7eb;font-size:12px;">
            ${formatEuroPrint(p.total)}
            <div style="font-size:10px;color:#9ca3af;font-weight:400">${formatEuroPrint(p.unitPrice)}/pz</div>
          </td>
        `;
      }).join('');
      rows += `
        <tr>
          <td style="padding:5px 10px;border:1px solid #e5e7eb;font-size:12px;">
            <strong>${row.name}</strong>
            <span style="color:#9ca3af;font-size:10px"> × ${row.quantity} ${row.unit}</span>
          </td>
          ${priceCols}
        </tr>
      `;
    }
  }

  const totalCols = storeTotals.map((s) => `
    <td style="text-align:center;padding:8px 10px;font-weight:700;font-size:13px;background:${s.sid === cheapestSid ? '#dcfce7' : '#f9fafb'};color:${s.sid === cheapestSid ? '#166534' : '#374151'};border:2px solid #d1d5db;">
      ${formatEuroPrint(s.total)}
    </td>
  `).join('');

  return `
    <section style="margin-bottom:24px">
      <h2 style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #16a34a;">
        📊 Confronto Prezzi per Supermercato
      </h2>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;background:#f9fafb;font-size:11px;border:1px solid #e5e7eb;">Prodotto</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td style="padding:8px 10px;font-weight:700;font-size:12px;border:2px solid #d1d5db;background:#f3f4f6">TOTALE SPESA</td>
              ${totalCols}
            </tr>
          </tbody>
        </table>
      </div>
      <p style="font-size:10px;color:#9ca3af;margin-top:6px">* Prezzi indicativi. Verifica sempre i prezzi in negozio prima dell'acquisto.</p>
    </section>
  `;
}

/**
 * Genera la sezione HTML del percorso ottimizzato
 */
function buildRouteHTML(result) {
  if (!result?.ordered_route?.length) return '';

  const route = result.ordered_route;
  const addressUsed = result.address_used || 'Casa tua';

  const stops = route.map((store, i) => `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
      <div style="min-width:24px;height:24px;border-radius:50%;background:#16a34a;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i + 1}</div>
      <div>
        <div style="font-weight:600;font-size:13px;color:#111827">${escapeHtml(store.insegna)}</div>
        ${store.address ? `<div style="font-size:11px;color:#6b7280">${escapeHtml(store.address)}</div>` : ''}
      </div>
    </div>
  `).join('');

  return `
    <section style="margin-bottom:24px">
      <h2 style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #16a34a;">
        🗺️ Percorso Ottimizzato
      </h2>
      <div style="padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="min-width:24px;height:24px;border-radius:50%;background:#6b7280;color:white;display:flex;align-items:center;justify-content:center;font-size:11px">🏠</div>
          <div style="font-size:12px;color:#6b7280">Partenza: <strong>${escapeHtml(addressUsed)}</strong></div>
        </div>
        ${stops}
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <div style="min-width:24px;height:24px;border-radius:50%;background:#e5e7eb;color:#6b7280;display:flex;align-items:center;justify-content:center;font-size:11px">🏠</div>
          <div style="font-size:12px;color:#9ca3af">Ritorno a casa</div>
        </div>
        ${result.total_km ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280">Distanza totale stimata: <strong style="color:#111827">${Number(result.total_km).toFixed(1)} km</strong></div>` : ''}
      </div>
    </section>
  `;
}

/**
 * Genera la sezione HTML del riepilogo costi
 */
function buildCostHTML(result, veicolo) {
  if (!result) return '';

  const { scenario_singolo, scenario_ottimale, risparmio_netto, consiglia_multi } = result;

  const scenarioCard = (title, s, highlighted) => `
    <div style="flex:1;padding:12px;border-radius:8px;border:2px solid ${highlighted ? '#86efac' : '#e5e7eb'};background:${highlighted ? '#f0fdf4' : '#f9fafb'}">
      <div style="font-weight:700;font-size:12px;color:#111827;margin-bottom:2px">${title}${highlighted ? ' ⭐' : ''}</div>
      ${s.nome_supermercato ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">${s.nome_supermercato}</div>` : ''}
      ${s.supermercati ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">${s.supermercati.length} negozi</div>` : ''}
      <table style="width:100%;font-size:11px">
        <tr><td style="color:#6b7280;padding:2px 0">Prodotti</td><td style="text-align:right;font-weight:600">${formatEuroPrint(s.somma_prezzi)}</td></tr>
        <tr><td style="color:#6b7280;padding:2px 0">Carburante</td><td style="text-align:right;font-weight:600">${formatEuroPrint(s.costo_carburante)}</td></tr>
        ${s.km ? `<tr><td style="color:#6b7280;padding:2px 0">Distanza</td><td style="text-align:right">${Number(s.km).toFixed(1)} km</td></tr>` : ''}
      </table>
      <div style="border-top:1px solid #d1d5db;margin-top:8px;padding-top:6px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;font-weight:600;color:#374151">Costo Reale</span>
        <span style="font-size:15px;font-weight:800;color:${highlighted ? '#15803d' : '#111827'}">${formatEuroPrint(s.costo_reale)}</span>
      </div>
    </div>
  `;

  const risparmioColor = risparmio_netto > 0 ? '#15803d' : '#dc2626';

  return `
    <section style="margin-bottom:24px">
      <h2 style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #16a34a;">
        💰 Riepilogo Costi
      </h2>
      ${risparmio_netto !== undefined ? `
        <div style="padding:12px;border-radius:8px;background:${risparmio_netto > 0 ? '#f0fdf4' : '#fef2f2'};border:1px solid ${risparmio_netto > 0 ? '#86efac' : '#fca5a5'};margin-bottom:12px;text-align:center">
          <div style="font-size:11px;color:#6b7280">Risparmio netto stimato</div>
          <div style="font-size:22px;font-weight:800;color:${risparmioColor}">${risparmio_netto > 0 ? '+' : ''}${formatEuroPrint(risparmio_netto)}</div>
          <div style="font-size:10px;color:#9ca3af">Già detratto il costo carburante aggiuntivo</div>
        </div>
      ` : ''}
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${scenario_singolo ? scenarioCard('Un solo negozio', scenario_singolo, !consiglia_multi) : ''}
        ${scenario_ottimale ? scenarioCard('Percorso ottimizzato', scenario_ottimale, consiglia_multi) : ''}
      </div>
      ${veicolo ? `
        <div style="margin-top:10px;font-size:10px;color:#9ca3af">
          Calcolo basato su: ${veicolo.consumo_medio} L/100km · ${formatEuroPrint(veicolo.prezzo_carburante_rif)}/L (${veicolo.tipo})
        </div>
      ` : ''}
    </section>
  `;
}

/**
 * Apre una finestra di stampa con il report completo
 */
export function printShoppingReport({ priceData, stores, optimizationResult, veicolo, userName, address }) {
  const now = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const priceTableHTML = buildPriceTableHTML(priceData, stores);
  const routeHTML      = buildRouteHTML(optimizationResult);
  const costHTML       = buildCostHTML(optimizationResult, veicolo);

  // Lista prodotti semplice (senza prezzi, per la spesa)
  const shoppingListHTML = priceData.length > 0 ? `
    <section style="margin-bottom:24px">
      <h2 style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #16a34a;">
        🛒 Lista della Spesa
      </h2>
      <div style="columns:2;gap:16px">
        ${priceData.map((item) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;break-inside:avoid">
            <div style="width:14px;height:14px;border:1.5px solid #d1d5db;border-radius:3px;flex-shrink:0"></div>
            <span style="font-size:12px;color:#111827"><strong>${item.name}</strong> <span style="color:#9ca3af">× ${item.quantity} ${item.unit}</span></span>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8" />
      <title>SpesaSmart — Report del ${now}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111827; background: white; padding: 24px; font-size: 13px; }
        @media print {
          body { padding: 0; }
          @page { margin: 1.5cm; size: A4; }
        }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>
      <!-- Header report -->
      <div style="border-bottom:3px solid #16a34a;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="width:28px;height:28px;background:#16a34a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px">🛒</div>
            <span style="font-size:20px;font-weight:800;color:#16a34a">SpesaSmart Optimizer</span>
          </div>
          <div style="font-size:11px;color:#6b7280">Report generato il ${now}</div>
          ${userName ? `<div style="font-size:11px;color:#6b7280">Utente: <strong>${escapeHtml(userName)}</strong></div>` : ''}
          ${address ? `<div style="font-size:11px;color:#6b7280">Da: <strong>${escapeHtml(address)}</strong></div>` : ''}
        </div>
        <div style="text-align:right;font-size:10px;color:#9ca3af">
          Ottimizzazione percorso<br>e calcolo Costo Reale
        </div>
      </div>

      ${shoppingListHTML}
      ${priceTableHTML}
      ${routeHTML}
      ${costHTML}

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;font-size:10px;color:#9ca3af;text-align:center">
        Report generato da SpesaSmart Optimizer · Costo Reale = Prezzi Prodotti + Costo Carburante
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Il browser ha bloccato il popup. Consenti i popup per questo sito e riprova.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
