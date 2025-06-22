// src/components/YouMightAlsoLike.tsx
'use client';

import React from 'react';

// A simple placeholder for a related profile card
const YouMightAlsoLikeCard: React.FC<{ name: string, image?: string }> = ({ name, image }) => (
    <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-md">
            {/* Placeholder for an image */}
        </div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-400">{name}</div>
    </div>
);


export default function YouMightAlsoLike() {
    // Dummy data for now. This would eventually be fetched or passed as props.
    const similarProfiles = [
        { name: 'Taeyeon' },
        { name: 'AKMU' },
    ];

    return (
        <div className="p-4 border border-gray-200 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-300 mb-4">You Might Also Like</h3>
            <div className="space-y-4">
                {similarProfiles.map(profile => (
                    <YouMightAlsoLikeCard key={profile.name} name={profile.name} />
                ))}
            </div>
        </div>
    );
}