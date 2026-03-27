import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function ErrorAlert({ message, onDismiss, className = '' }) {
  const [visible, setVisible] = useState(true);

  if (!visible || !message) return null;

  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  return (
    <div className={`rounded-lg bg-red-50 border border-red-200 p-4 ${className}`}>
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="ml-3 flex-1">
          <p className="text-sm text-red-700">{message}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
