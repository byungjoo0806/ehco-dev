'use client';

import { useState, useCallback } from 'react';
import CategoryFilter from './CategoryFilter';
import NewsFeed from './NewsFeed';
import { useCelebrity } from '@/lib/hooks/useCelebrity';

interface NewsFeedContainerProps {
    celebrityId: string;
}

export default function NewsFeedContainer({ celebrityId }: NewsFeedContainerProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const { loading } = useCelebrity(celebrityId);

    const handleCategoryChange = useCallback((category: string | null) => {
        setSelectedCategory(category);
    }, []);

    const handleSortChange = useCallback((sort: 'newest' | 'oldest') => {
        setSortOrder(sort);
    }, []);

    if (loading) {
        return (
            <div className="w-[90%] md:w-[75%] lg:w-[60%] mx-auto px-4 py-8">
                {/* Loading skeleton for CategoryFilter */}
                <div className="mb-6 space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-32" />
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-10 bg-gray-100 rounded-full w-24" />
                        ))}
                    </div>
                </div>

                {/* Loading skeleton for NewsFeed */}
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                            <div className="h-4 bg-gray-100 rounded w-2/3 mb-4" />
                            <div className="flex gap-4 bg-white rounded-lg">
                                <div className="w-32 h-24 bg-gray-200 rounded-l-lg" />
                                <div className="flex-1 py-3 pr-4 space-y-3">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                                    <div className="h-3 bg-gray-200 rounded w-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-[90%] md:w-[75%] lg:w-[60%] mx-auto px-4 py-8">
            <CategoryFilter
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                currentSort={sortOrder}
                onSortChange={handleSortChange}
            />
            <NewsFeed
                celebrityId={celebrityId}
                selectedCategory={selectedCategory}
                sortOrder={sortOrder}
            />
        </div>
    );
}