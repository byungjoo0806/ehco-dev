// src/components/DebugLazyLoading.tsx (optional debugging component)

'use client';

import React from 'react';
import { Article } from '@/types/definitions';

interface DebugLazyLoadingProps {
    articlesMap: Map<string, Article>;
    loadingArticleIds: Set<string>;
    isLoading: boolean;
    loadedCount: number;
    totalCount: number;
    remainingArticleIds: string[];
}

const DebugLazyLoading: React.FC<DebugLazyLoadingProps> = ({
    articlesMap,
    loadingArticleIds,
    isLoading,
    loadedCount,
    totalCount,
    remainingArticleIds
}) => {
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-xs z-50">
            <div className="font-bold mb-2">Lazy Loading Debug</div>
            <div>Articles in map: {articlesMap.size}</div>
            <div>Loading: {loadingArticleIds.size}</div>
            <div>Is loading: {isLoading ? 'Yes' : 'No'}</div>
            <div>Loaded: {loadedCount}/{totalCount}</div>
            <div>Remaining: {remainingArticleIds.length}</div>

            {loadingArticleIds.size > 0 && (
                <div className="mt-2">
                    <div className="font-semibold">Currently loading:</div>
                    <div className="max-h-20 overflow-y-auto">
                        {Array.from(loadingArticleIds).slice(0, 5).map(id => (
                            <div key={id} className="truncate">{id}</div>
                        ))}
                        {loadingArticleIds.size > 5 && <div>...and {loadingArticleIds.size - 5} more</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugLazyLoading;