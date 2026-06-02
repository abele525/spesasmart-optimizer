// Componente spinner di caricamento riutilizzabile
export default function LoadingSpinner({ size = 'md', text = 'Caricamento...' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizes[size]} rounded-full border-primary-200 border-t-primary-600 spinner`}
      />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}

// Full-page loader
export function FullPageLoader() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <div className="h-14 w-14 rounded-full border-4 border-primary-200 border-t-primary-600 spinner mx-auto mb-4" />
        <p className="text-gray-600 font-medium">SpesaSmart Optimizer</p>
        <p className="text-sm text-gray-400 mt-1">Caricamento in corso...</p>
      </div>
    </div>
  );
}
