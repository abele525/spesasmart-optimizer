// ============================================================
// ProfilePage — Gestione profilo utente, veicolo, famiglia
// ============================================================
import { useState } from 'react';
import {
  User, Car, Users, MapPin, Save, LogOut, Bell, Fuel,
  Link2, Shield, Trash2,
} from 'lucide-react';
import { useAuth }     from '../contexts/AuthContext';
import { useShopping } from '../contexts/ShoppingContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const TIPI_CARBURANTE = [
  { value: 'benzina',   label: 'Benzina',  default_price: 1.85 },
  { value: 'diesel',    label: 'Diesel',   default_price: 1.75 },
  { value: 'gpl',       label: 'GPL',      default_price: 0.85 },
  { value: 'metano',    label: 'Metano',   default_price: 1.45 },
  { value: 'elettrico', label: 'Elettrico (€/kWh)', default_price: 0.25 },
];

export default function ProfilePage() {
  const { currentUser, userProfile, updateUserProfile, logout } = useAuth();
  const { clearAll }   = useShopping();
  const navigate       = useNavigate();

  // Stato form profilo
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [indirizzo, setIndirizzo]     = useState(userProfile?.indirizzo || '');
  const [cap, setCap]                 = useState(userProfile?.cap_predefinito || '');
  const [familyId, setFamilyId]       = useState(userProfile?.family_id || '');
  const [verificandoIndirizzo, setVerificandoIndirizzo] = useState(false);

  // Stato form veicolo
  const [tipoVeicolo, setTipoVeicolo]   = useState(userProfile?.veicolo?.tipo || 'benzina');
  const [consumo, setConsumo]             = useState(userProfile?.veicolo?.consumo_medio || 7.0);
  const [prezzoCarb, setPrezzoCarb]       = useState(userProfile?.veicolo?.prezzo_carburante_rif || 1.85);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Geocodifica l'indirizzo per ottenere le coordinate esatte
  async function geocodificaIndirizzo(addr) {
    setVerificandoIndirizzo(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ', Italy')}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'it' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          display: data[0].display_name,
        };
      }
      return null;
    } finally {
      setVerificandoIndirizzo(false);
    }
  }

  // Salva profilo base
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!indirizzo.trim()) return toast.error('Inserisci il tuo indirizzo di casa');
    setSavingProfile(true);
    try {
      // Geocodifica l'indirizzo per salvare anche le coordinate
      const coords = await geocodificaIndirizzo(indirizzo.trim());
      if (!coords) {
        toast.error('Indirizzo non trovato. Prova a scriverlo in modo più preciso.');
        setSavingProfile(false);
        return;
      }
      // Estrai il CAP dall'indirizzo se non inserito
      const capFromAddress = indirizzo.match(/\b\d{5}\b/)?.[0] || cap;

      await updateUserProfile({
        displayName: displayName.trim(),
        indirizzo: indirizzo.trim(),
        indirizzo_coords: { lat: coords.lat, lng: coords.lng },
        cap_predefinito: capFromAddress,
        family_id: familyId.trim() || null,
      });
      toast.success(`Profilo aggiornato! Posizione: ${coords.display.split(',').slice(0, 2).join(',')}`);
    } catch {
      toast.error('Errore durante il salvataggio');
    } finally {
      setSavingProfile(false);
    }
  }

  // Salva dati veicolo
  async function handleSaveVehicle(e) {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      await updateUserProfile({
        veicolo: {
          tipo: tipoVeicolo,
          consumo_medio: Number(consumo),
          prezzo_carburante_rif: Number(prezzoCarb),
        },
      });
      toast.success('Dati veicolo aggiornati!');
    } catch {
      toast.error('Errore durante il salvataggio');
    } finally {
      setSavingVehicle(false);
    }
  }

  // Aggiorna prezzo default al cambio tipo carburante
  function handleTipoChange(tipo) {
    setTipoVeicolo(tipo);
    const found = TIPI_CARBURANTE.find((t) => t.value === tipo);
    if (found) setPrezzoCarb(found.default_price);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
    toast.success('Uscita effettuata');
  }

  async function handleClearList() {
    if (!confirm('Svuotare tutta la lista? Questa azione non può essere annullata.')) return;
    try {
      await clearAll();
      toast.success('Lista svuotata');
    } catch {
      toast.error('Errore');
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="section-title flex items-center gap-2">
          <User className="h-6 w-6 text-primary-600" />
          Il mio Profilo
        </h1>
        <p className="section-subtitle">{currentUser?.email}</p>
      </div>

      {/* Sezione: Dati personali */}
      <form onSubmit={handleSaveProfile} className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-gray-500" />
          Dati personali
        </h2>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome visualizzato</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
              placeholder="Il tuo nome"
            />
          </div>

          {/* Indirizzo di casa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
              Indirizzo di casa
            </label>
            <input
              type="text"
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
              className="input-field"
              placeholder="es. Via Roma 1, 51031 Agliana (PT)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Inserisci via, numero civico, CAP e città — le distanze verranno calcolate da qui
            </p>
            {userProfile?.indirizzo_coords && (
              <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Posizione verificata ✓
              </p>
            )}
          </div>

          {/* Family ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
              ID Famiglia (Family Sync)
            </label>
            <input
              type="text"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className="input-field"
              placeholder="es. famiglia-rossi-2024"
            />
            <p className="text-xs text-gray-500 mt-1">
              Stesso ID = lista condivisa in tempo reale (stile Bring!)
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="btn-primary mt-5 flex items-center gap-2"
        >
          {savingProfile
            ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full spinner" />
            : <Save className="h-4 w-4" />}
          Salva profilo
        </button>
      </form>

      {/* Sezione: Veicolo */}
      <form onSubmit={handleSaveVehicle} className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Car className="h-4 w-4 text-gray-500" />
          Il mio veicolo
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Usato per calcolare il costo del carburante nel Costo Reale.
        </p>

        <div className="space-y-4">
          {/* Tipo carburante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Fuel className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
              Tipo carburante
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIPI_CARBURANTE.map((tipo) => (
                <label
                  key={tipo.value}
                  className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-sm ${
                    tipoVeicolo === tipo.value
                      ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_carburante"
                    value={tipo.value}
                    checked={tipoVeicolo === tipo.value}
                    onChange={() => handleTipoChange(tipo.value)}
                    className="sr-only"
                  />
                  {tipo.label}
                </label>
              ))}
            </div>
          </div>

          {/* Consumo medio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consumo medio (L/100km o kWh/100km)
            </label>
            <input
              type="number"
              value={consumo}
              onChange={(e) => setConsumo(e.target.value)}
              className="input-field"
              min={0.5}
              max={30}
              step={0.5}
            />
          </div>

          {/* Prezzo carburante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prezzo carburante di riferimento (€/L o €/kWh)
            </label>
            <input
              type="number"
              value={prezzoCarb}
              onChange={(e) => setPrezzoCarb(e.target.value)}
              className="input-field"
              min={0.01}
              max={5}
              step={0.01}
            />
          </div>

          {/* Preview calcolo */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Preview calcolo per 10 km:</p>
            <p>Costo carburante ≈ <strong className="text-primary-700">
              €{((10 * Number(consumo) * Number(prezzoCarb)) / 100).toFixed(3)}
            </strong></p>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingVehicle}
          className="btn-primary mt-5 flex items-center gap-2"
        >
          {savingVehicle
            ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full spinner" />
            : <Save className="h-4 w-4" />}
          Salva veicolo
        </button>
      </form>

      {/* Sezione: Privacy & Sicurezza */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-500" />
          Privacy & Sicurezza
        </h2>
        <div className="space-y-2">
          <InfoRow
            icon={Bell}
            label="Notifiche push"
            value="Attive per alert di prezzo"
          />
          <InfoRow
            icon={Link2}
            label="Sincronizzazione"
            value={userProfile?.family_id ? `Famiglia: ${userProfile.family_id}` : 'Solo personale'}
          />
          <InfoRow
            icon={Shield}
            label="Dati"
            value="Protetti da Firestore Security Rules"
          />
        </div>
      </div>

      {/* Azioni pericolose */}
      <div className="card border-red-100">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-500" />
          Azioni
        </h2>
        <div className="space-y-3">
          <button
            onClick={handleClearList}
            className="w-full text-left px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-3 text-sm font-medium"
          >
            <Trash2 className="h-4 w-4" />
            Svuota tutta la lista della spesa
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Esci dall&apos;account
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </div>
      <span className="text-sm text-gray-700 font-medium">{value}</span>
    </div>
  );
}
