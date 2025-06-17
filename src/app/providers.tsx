'use client'; // This is the most important part!

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FiguresProvider } from '@/context/FiguresContext';

export function Providers({ children }: { children: React.ReactNode }) {
    // This ensures a new QueryClient is not created on every render
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <FiguresProvider>
                {children}
            </FiguresProvider>
        </QueryClientProvider>
    );
}