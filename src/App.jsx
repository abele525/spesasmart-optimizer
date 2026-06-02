// ============================================================
// App.jsx — Routing principale e protezione delle rotte
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ShoppingProvider }       from './contexts/ShoppingContext';
import Layout                      from './components/Layout/Layout';
import { FullPageLoader }          from './components/common/LoadingSpinner';

// Pagine
import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ListaPage     from './pages/ListaPage';
import OptimizerPage from './pages/OptimizerPage';
import MapPage       from './pages/MapPage';
import ProfilePage   from './pages/ProfilePage';

// Rotta protetta: reindirizza al login se non autenticato
function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return currentUser ? children : <Navigate to="/login" replace />;
}

// Rotta pubblica: reindirizza alla dashboard se già autenticato
function PublicRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return !currentUser ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Rotte pubbliche */}
      <Route path="/login"     element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/registrati" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Rotte protette */}
      <Route path="/dashboard" element={
        <PrivateRoute>
          <ShoppingProvider>
            <Layout><DashboardPage /></Layout>
          </ShoppingProvider>
        </PrivateRoute>
      } />
      <Route path="/lista" element={
        <PrivateRoute>
          <ShoppingProvider>
            <Layout><ListaPage /></Layout>
          </ShoppingProvider>
        </PrivateRoute>
      } />
      <Route path="/ottimizza" element={
        <PrivateRoute>
          <ShoppingProvider>
            <Layout><OptimizerPage /></Layout>
          </ShoppingProvider>
        </PrivateRoute>
      } />
      <Route path="/mappa" element={
        <PrivateRoute>
          <ShoppingProvider>
            <Layout><MapPage /></Layout>
          </ShoppingProvider>
        </PrivateRoute>
      } />
      <Route path="/profilo" element={
        <PrivateRoute>
          <ShoppingProvider>
            <Layout><ProfilePage /></Layout>
          </ShoppingProvider>
        </PrivateRoute>
      } />

      {/* Redirect di default */}
      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#111827',
              borderRadius: '0.75rem',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '0.875rem',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
