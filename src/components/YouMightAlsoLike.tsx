// src/components/YouMightAlsoLike.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createUrlSlug } from '@/lib/slugify';

interface SimilarProfile {
    id: string;
    name: string;
    name_kr: string;
    profilePic?: string;
}

// A simple placeholder for a related profile card
const YouMightAlsoLikeCard: React.FC<SimilarProfile> = ({ id, name, name_kr, profilePic }) => (
    <Link href={`/${createUrlSlug(id)}`} className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-md transition-colors">
        <div className="relative w-12 h-12 bg-gray-200 rounded-md overflow-hidden">
            {profilePic ? (
                <Image
                    src={profilePic}
                    alt={`${name}'s profile picture`}
                    fill
                    sizes="48px"
                    style={{ objectFit: 'cover' }}
                />
            ) : (
                <div className="w-full h-full bg-gray-300"></div> // Fallback
            )}
        </div>
        <div>
            <div className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">{name}</div>
            <div className="text-xs text-gray-500">{name_kr}</div>
        </div>
    </Link>
);


export default function YouMightAlsoLike({ similarProfiles }: { similarProfiles: SimilarProfile[] }) {
    if (!similarProfiles || similarProfiles.length === 0) {
        return null; // Don't render the component if there's no one to show
    }

    return (
        <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">You Might Also Like</h3>
            <div className="space-y-2">
                {similarProfiles.map(profile => (
                    <YouMightAlsoLikeCard key={profile.id} {...profile} />
                ))}
            </div>
        </div>
    );
}