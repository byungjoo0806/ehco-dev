// src/components/FigureNotFound.tsx
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface FigureNotFoundProps {
    figureId: string;
}

const FigureNotFound = ({ figureId }: FigureNotFoundProps) => {
    return (
        <div className="flex flex-col items-center justify-center text-center h-screen -mt-20">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Profile Not Found
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
                A page for &quot;{figureId}&quot; does not exist or has not been created yet.
            </p>
            <Link href="/" className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors">
                Return to Homepage
            </Link>
        </div>
    );
};

export default FigureNotFound;