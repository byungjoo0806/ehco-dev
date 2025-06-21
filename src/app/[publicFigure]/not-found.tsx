// src/app/[publicFigure]/not-found.tsx
'use client'; // This component should be a client component

import { usePathname } from 'next/navigation';
import FigureNotFound from '@/components/FigureNotFound';

export default function NotFound() {
    const pathname = usePathname();
    // Extracts the slug (e.g., "figure-name") from "/figure-name"
    const figureId = pathname.substring(1);

    return <FigureNotFound figureId={figureId} />;
}