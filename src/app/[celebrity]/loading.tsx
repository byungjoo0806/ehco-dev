// src/app/[celebrity]/loading.tsx
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
      </div>
    </div>
  );
}