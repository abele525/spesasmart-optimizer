// ============================================================
// Navbar — Barra di navigazione principale
// ============================================================
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Map, User, LogOut, Menu, X, Bell, Home, TrendingDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useShopping } from '../../contexts/ShoppingContext';
import toast from 'react-hot-toast';

const navLinks = [
  { to: '/dashboard', icon: Home,        label: 'Dashboard' },
  { to: '/lista',     icon: ShoppingCart, label: 'Lista' },
  { to: '/ottimizza', icon: TrendingDown, label: 'Ottimizza' },
  { to: '/mappa',     icon: Map,          label: 'Mappa' },
  { to: '/profilo',   icon: User,         label: 'Profilo' },
];

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const { shoppingList, priceAlerts }        = useShopping();
  const [mobileOpen, setMobileOpen]          = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const uncheckedCount  = shoppingList.filter((i) => !i.checked).length;
  const activeAlertsCount = priceAlerts.filter((a) => a.is_active).length;

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
      toast.success('Uscita effettuata');
    } catch {
      toast.error('Errore durante il logout');
    }
  }

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + link MealPlanner */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 text-primary-600 font-bold text-lg">
              <ShoppingCart className="h-6 w-6" />
              <span className="hidden sm:block">SpesaSmart</span>
            </Link>
            <a href="https://nutrition-self-six.vercel.app" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors border border-gray-200 rounded-lg px-2 py-1 hover:border-green-300">
              🥦 MealPlanner
            </a>
          </div>

          {/* Nav desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(to)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {/* Badge contatore lista */}
                {to === '/lista' && uncheckedCount > 0 && (
                  <span className="ml-1 bg-primary-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                    {uncheckedCount > 9 ? '9+' : uncheckedCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Destra: notifiche + utente */}
          <div className="flex items-center gap-3">
            {/* Badge alert di prezzo */}
            {activeAlertsCount > 0 && (
              <div className="relative hidden sm:block">
                <Bell className="h-5 w-5 text-gray-500" />
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {activeAlertsCount}
                </span>
              </div>
            )}

            {/* Nome utente desktop */}
            <span className="hidden md:block text-sm text-gray-600 font-medium max-w-[120px] truncate">
              {userProfile?.displayName || currentUser?.email?.split('@')[0]}
            </span>

            {/* Logout desktop */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Esci
            </button>

            {/* Menu hamburger mobile */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white py-2 px-4 animate-fade-in">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mb-1 ${
                isActive(to)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {to === '/lista' && uncheckedCount > 0 && (
                <span className="ml-auto bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {uncheckedCount}
                </span>
              )}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg mt-1 font-medium"
          >
            <LogOut className="h-5 w-5" />
            Esci
          </button>
        </div>
      )}
    </nav>
  );
}
