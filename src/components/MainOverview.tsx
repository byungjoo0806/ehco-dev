// src/components/MainOverview.tsx
'use client';

import React from 'react';

interface MainOverviewProps {
    mainOverview?: {
        id: string;
        content: string;
        articleIds: string[];
    };
}

export default function MainOverview({ mainOverview }: MainOverviewProps) {
    return (
        <div className="w-full mt-6">
            <h2 className="text-xl font-bold mb-4 text-black dark:text-white">
                Overview
            </h2>
            {mainOverview?.content ? (
                <div className="prose prose-sm text-black dark:text-gray-400 max-w-none">
                    {/* Using dangerouslySetInnerHTML to render potential HTML tags if any, or just replace newlines */}
                    <p dangerouslySetInnerHTML={{ __html: mainOverview.content.replace(/\n/g, '<br />').replaceAll("*", "'") }} />
                </div>
            ) : (
                <div className="text-gray-500 dark:text-gray-400">
                    No overview content available.
                </div>
            )}
        </div>
    );
}