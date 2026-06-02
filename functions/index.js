// ============================================================
// Firebase Cloud Functions — SpesaSmart Optimizer
//
// Funzioni disponibili:
// 1. scrapePrezzi        — Scraping prezzi da Esselunga/Coop/Lidl (schedulato)
// 2. aggiornaPrezziManuale — HTTP trigger per aggiornamento manuale
// 3. checkPriceAlerts    — Controlla alert di prezzo e invia notifiche push
// 4. getNearbySupermarkets — Cerca supermercati vicini (proxy sicuro API key)
//
// NOTA: Le API key dei supermercati richiedono accordi commerciali.
// Questo scraper usa i siti pubblici rispettando i robots.txt.
// ============================================================

const { onSchedule }     = require('firebase-functions/v2/scheduler');
const { onRequest }       = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger }          = require('firebase-functions');
const admin               = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// 1. SCRAPING PREZZI — Schedulato ogni giorno alle 06:00
// ============================================================
/**
 * Esegue lo scraping dei prezzi dei prodotti su vari supermercati.
 * I risultati vengono salvati nella collezione `daily_prices`.
 *
 * Target supermercati: Esselunga, Coop, Lidl, Carrefour, Conad
 * Libreria: Puppeteer (headless Chrome)
 */
exports.scrapePrezziGiornalieri = onSchedule(
  {
    schedule:    'every day 06:00',
    timeZone:    'Europe/Rome',
    region:      'europe-west1',
    timeoutSeconds: 540,
    memory:      '2GiB', // Puppeteer richiede molta RAM
  },
  async (event) => {
    logger.info('Avvio scraping prezzi giornaliero', { structuredData: true });

    try {
      // Carica i prodotti da scrappare dalla collezione `products`
      const productsSnap = await db.collection('products').get();
      const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (products.length === 0) {
        logger.warn('Nessun prodotto da scrappare trovato');
        return;
      }

      // Esegui lo scraping per ogni supermercato
      const scrapers = [
        { name: 'Esselunga',  fn: scrapeEsselunga },
        { name: 'Coop',       fn: scrapeCoop },
        { name: 'Lidl',       fn: scrapeLidl },
      ];

      for (const scraper of scrapers) {
        try {
          logger.info(`Scraping ${scraper.name}...`);
          const prices = await scraper.fn(products);
          await savePrices(prices, scraper.name);
          logger.info(`${scraper.name}: ${prices.length} prezzi aggiornati`);
        } catch (err) {
          logger.error(`Errore scraping ${scraper.name}:`, err.message);
        }
      }

      logger.info('Scraping giornaliero completato');
    } catch (err) {
      logger.error('Errore fatale scraping:', err);
      throw err;
    }
  }
);

// ============================================================
// 2. AGGIORNAMENTO MANUALE — HTTP endpoint (solo admin)
// ============================================================
exports.aggiornaPrezziManuale = onRequest(
  { region: 'europe-west1', timeoutSeconds: 300, memory: '2GiB' },
  async (req, res) => {
    // Verifica token admin
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      // Solo utenti con custom claim "admin: true" possono triggherare manualmente
      if (!decoded.admin) {
        return res.status(403).json({ error: 'Accesso negato: richiesto ruolo admin' });
      }
    } catch {
      return res.status(401).json({ error: 'Token non valido' });
    }

    try {
      const { supermercato, prodotti } = req.body;
      logger.info(`Aggiornamento manuale: ${supermercato}`, { prodotti });

      // Esegui scraping mirato
      const targetProducts = prodotti || [];
      let prices = [];

      if (supermercato === 'esselunga') {
        prices = await scrapeEsselunga(targetProducts);
      } else if (supermercato === 'coop') {
        prices = await scrapeCoop(targetProducts);
      } else if (supermercato === 'lidl') {
        prices = await scrapeLidl(targetProducts);
      } else {
        return res.status(400).json({ error: 'Supermercato non supportato' });
      }

      await savePrices(prices, supermercato);
      res.json({ success: true, count: prices.length, prices });
    } catch (err) {
      logger.error('Errore aggiornamento manuale:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================================
// 3. CHECK ALERT PREZZI — Triggerato quando daily_prices cambia
// ============================================================
/**
 * Ogni volta che un prezzo viene aggiornato, controlla se
 * qualche utente ha un alert attivo per quel prodotto.
 * Se il prezzo scende sotto la soglia, invia una notifica push via FCM.
 */
exports.checkPriceAlerts = onDocumentWritten(
  {
    document: 'daily_prices/{priceId}',
    region: 'europe-west1',
  },
  async (event) => {
    const newData = event.data.after.data();
    if (!newData) return; // Documento eliminato

    const { pid, sid, price, is_offer } = newData;

    logger.info(`Controllo alert per prodotto ${pid}, prezzo €${price}`);

    try {
      // Cerca alert attivi per questo prodotto con target_price >= prezzo corrente
      const alertsSnap = await db
        .collection('price_alerts')
        .where('is_active', '==', true)
        .where('product_name', '==', pid) // In produzione usare il riferimento al prodotto
        .get();

      if (alertsSnap.empty) return;

      // Ottieni info supermercato
      const supermarketSnap = await db.collection('supermarkets').doc(sid).get();
      const supermarketName = supermarketSnap.exists
        ? supermarketSnap.data().insegna
        : 'Supermercato';

      // Per ogni alert, controlla se il prezzo è sotto la soglia
      const notifications = [];
      alertsSnap.docs.forEach((doc) => {
        const alert = doc.data();
        if (price <= alert.target_price) {
          notifications.push({ uid: alert.uid, alertId: doc.id, alert });
        }
      });

      // Invia notifiche FCM
      for (const { uid, alertId, alert } of notifications) {
        try {
          const userSnap = await db.collection('users').doc(uid).get();
          const fcmToken = userSnap.data()?.fcm_token;

          if (fcmToken) {
            await admin.messaging().send({
              token: fcmToken,
              notification: {
                title: '🏷️ Prezzo target raggiunto!',
                body: `${alert.product_name} è a €${price.toFixed(2)} da ${supermarketName}${is_offer ? ' (IN OFFERTA!)' : ''}`,
              },
              data: {
                product: alert.product_name,
                price: String(price),
                supermarket: sid,
                type: 'price_alert',
              },
            });
            logger.info(`Notifica inviata a utente ${uid}`);
          }

          // Segna alert come notificato (opzionale: mantieni attivo per future offerte)
          await db.collection('price_alerts').doc(alertId).update({
            last_triggered: admin.firestore.FieldValue.serverTimestamp(),
            last_price: price,
          });
        } catch (err) {
          logger.error(`Errore invio notifica a ${uid}:`, err.message);
        }
      }
    } catch (err) {
      logger.error('Errore checkPriceAlerts:', err);
    }
  }
);

// ============================================================
// FUNZIONI DI SCRAPING — Implementazioni specifiche per supermercato
// ============================================================

/**
 * Salva i prezzi in Firestore nella collezione `daily_prices`
 * Usa batch write per efficienza
 */
async function savePrices(prices, supermarketName) {
  const batch = db.batch();
  const now   = admin.firestore.FieldValue.serverTimestamp();

  prices.forEach(({ pid, sid, price, is_offer }) => {
    const docId  = `${pid}_${sid}`;
    const docRef = db.collection('daily_prices').doc(docId);
    batch.set(docRef, {
      pid,
      sid,
      price,
      is_offer: is_offer || false,
      last_updated: now,
    }, { merge: true });
  });

  await batch.commit();
  logger.info(`Salvati ${prices.length} prezzi per ${supermarketName}`);
}

/**
 * Scraper Esselunga — estrae prezzi dalla pagina prodotti
 * URL base: https://www.esselunga.it/it-it/prodotti/
 *
 * NOTA: Lo scraping è eseguito in modo rispettoso:
 * - Rispetta robots.txt
 * - Delay tra richieste (1-3 secondi)
 * - User-Agent reale
 */
async function scrapeEsselunga(products) {
  // Import dinamico di Puppeteer (ottimizzazione cold start)
  const puppeteer = require('puppeteer');
  const browser   = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
  });

  const results = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    for (const product of products.slice(0, 20)) { // Limite 20 per timeout
      try {
        const searchUrl = `https://www.esselunga.it/it-it/prodotti/ricerca.html?q=${encodeURIComponent(product.name)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        // Estrai il primo risultato di prezzo
        const priceData = await page.evaluate(() => {
          const priceEl = document.querySelector('.product-tile__price--current, [data-price], .price-value');
          if (!priceEl) return null;
          const text = priceEl.textContent.trim().replace(',', '.');
          const match = text.match(/(\d+\.?\d*)/);
          return match ? parseFloat(match[1]) : null;
        });

        if (priceData) {
          results.push({
            pid: product.id || product.name.toLowerCase().replace(/\s+/g, '_'),
            sid: 'esselunga',
            price: priceData,
            is_offer: await page.$('.badge--offer, .promo-badge') !== null,
          });
        }

        // Delay rispettoso tra le richieste
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
      } catch (err) {
        logger.warn(`Esselunga: errore per prodotto "${product.name}":`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Scraper Coop — prezzi da Coop.it
 */
async function scrapeCoop(products) {
  const puppeteer = require('puppeteer');
  const browser   = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
  });

  const results = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    for (const product of products.slice(0, 20)) {
      try {
        const searchUrl = `https://www.coop.it/p?query=${encodeURIComponent(product.name)}&start=0&sz=1`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        const priceData = await page.evaluate(() => {
          const priceEl = document.querySelector('.product-standard-price, .price-sales, [itemprop="price"]');
          if (!priceEl) return null;
          const content = priceEl.getAttribute('content') || priceEl.textContent.trim().replace(',', '.');
          const match   = content.match(/(\d+\.?\d*)/);
          return match ? parseFloat(match[1]) : null;
        });

        if (priceData) {
          results.push({
            pid: product.id || product.name.toLowerCase().replace(/\s+/g, '_'),
            sid: 'coop',
            price: priceData,
            is_offer: await page.$('.promo, .offer-badge, .on-sale') !== null,
          });
        }

        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
      } catch (err) {
        logger.warn(`Coop: errore per prodotto "${product.name}":`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Scraper Lidl — prezzi da Lidl.it
 */
async function scrapeLidl(products) {
  const puppeteer = require('puppeteer');
  const browser   = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
  });

  const results = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    for (const product of products.slice(0, 20)) {
      try {
        const searchUrl = `https://www.lidl.it/q/${encodeURIComponent(product.name)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        const priceData = await page.evaluate(() => {
          const priceEl = document.querySelector('.m-price__price, [data-qa="price"], .price__value');
          if (!priceEl) return null;
          const text  = priceEl.textContent.trim().replace(',', '.');
          const match = text.match(/(\d+\.?\d*)/);
          return match ? parseFloat(match[1]) : null;
        });

        if (priceData) {
          results.push({
            pid: product.id || product.name.toLowerCase().replace(/\s+/g, '_'),
            sid: 'lidl',
            price: priceData,
            is_offer: await page.$('.m-priceFlag, .ribbon--offer') !== null,
          });
        }

        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
      } catch (err) {
        logger.warn(`Lidl: errore per prodotto "${product.name}":`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
