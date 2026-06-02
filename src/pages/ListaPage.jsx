// Pagina lista della spesa — legge il tab iniziale dal router state (es. dashboard)
import { useLocation } from 'react-router-dom';
import ShoppingListComponent from '../components/ShoppingList/ShoppingList';

export default function ListaPage() {
  const { state } = useLocation();
  return <ShoppingListComponent initialTab={state?.tab || 'lista'} />;
}
