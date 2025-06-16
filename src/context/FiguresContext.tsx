'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface PublicFigure {
    id: string;
    name: string;
    profilePic?: string;
}

interface FiguresContextType {
    figures: PublicFigure[];
    isLoading: boolean;
    error: string | null;
}

const FiguresContext = createContext<FiguresContextType | undefined>(undefined);

export const FiguresProvider = ({ children }: { children: ReactNode }) => {
    const [figures, setFigures] = useState<PublicFigure[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch only if figures haven't been loaded yet
        if (figures.length === 0) {
            const fetchFigures = async () => {
                try {
                    setIsLoading(true);
                    const response = await fetch('/api/public-figures/top');
                    if (!response.ok) {
                        throw new Error('Failed to fetch figures');
                    }
                    const data = await response.json();
                    setFigures(data);
                } catch (err) {
                    if (err instanceof Error) {
                        setError(err.message);
                    } else {
                        setError('An unexpected error occurred');
                    }
                } finally {
                    setIsLoading(false);
                }
            };

            fetchFigures();
        }
    }, [figures.length]); // Dependency ensures this runs only once

    const value = { figures, isLoading, error };

    return (
        <FiguresContext.Provider value={value}>
            {children}
        </FiguresContext.Provider>
    );
};

// Custom hook to use the context easily
export const useFigures = () => {
    const context = useContext(FiguresContext);
    if (context === undefined) {
        throw new Error('useFigures must be used within a FiguresProvider');
    }
    return context;
};