// ============================================================
// BarcodeScanner — Scanner codice a barre via fotocamera
// Usa @zxing/browser + Open Food Facts per nome prodotto
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, Camera, Loader2, AlertCircle } from 'lucide-react';

async function lookupBarcode(barcode) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_it,product_name_en,categories_tags`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1) return null;
    return (
      data.product?.product_name_it ||
      data.product?.product_name ||
      data.product?.product_name_en ||
      null
    );
  } catch {
    return null;
  }
}

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState('init'); // init | scanning | found | error
  const [errorMsg, setErrorMsg] = useState('');
  const [lastBarcode, setLastBarcode] = useState('');

  useEffect(() => {
    let stopped = false;
    readerRef.current = new BrowserMultiFormatReader();

    async function startScan() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          setErrorMsg('Nessuna fotocamera trovata sul dispositivo.');
          setStatus('error');
          return;
        }
        // Preferisce fotocamera posteriore
        const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];

        setStatus('scanning');

        readerRef.current.decodeFromVideoDevice(back.deviceId, videoRef.current, async (result, err) => {
          if (stopped) return;
          if (result) {
            const barcode = result.getText();
            if (barcode === lastBarcode) return;
            setLastBarcode(barcode);
            setStatus('found');

            const name = await lookupBarcode(barcode);
            if (!stopped) {
              onDetected({ barcode, name: name || '' });
            }
          }
        });
      } catch (e) {
        if (!stopped) {
          setErrorMsg(
            e.name === 'NotAllowedError'
              ? 'Accesso alla fotocamera negato. Controlla i permessi del browser.'
              : `Errore fotocamera: ${e.message}`
          );
          setStatus('error');
        }
      }
    }

    startScan();

    return () => {
      stopped = true;
      try { readerRef.current?.reset(); } catch { /* noop */ }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white">
            <Camera className="h-5 w-5 text-emerald-400" />
            <span className="font-medium">Scansiona codice a barre</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Viewport fotocamera */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

          {/* Mirino */}
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-32 border-2 border-emerald-400 rounded-lg relative">
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />
              </div>
            </div>
          )}

          {/* Overlay stato */}
          {status === 'init' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
            </div>
          )}
          {status === 'found' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
              <span className="absolute mt-16 text-white text-sm">Ricerca prodotto...</span>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
              <p className="text-white text-sm">{errorMsg}</p>
            </div>
          )}
        </div>

        <p className="text-center text-white/60 text-xs mt-3">
          Punta la fotocamera sul codice a barre del prodotto
        </p>
      </div>
    </div>
  );
}
