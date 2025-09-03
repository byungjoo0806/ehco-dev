// src/components/LoadingOverlay.tsx
'use client';

import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible?: boolean;
  message?: string;
}

const LoadingOverlay = ({ isVisible = true, message = "Loading..." }: LoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
        <Loader2 className="animate-spin text-slate-600" size={24} />
        <span className="text-slate-600 font-medium">{message}</span>
      </div>
    </div>
  );
};

export default LoadingOverlay;
