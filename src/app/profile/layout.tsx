// src/app/profile/layout.tsx
'use client'; // The context provider is a client component, so the layout using it must be too.

import { ProfileDataProvider } from '@/context/ProfileDataContext';
import React from 'react';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    // By placing the provider here, it will mount once and persist
    // across navigations between /profile, /profile/favorites, etc.
    return (
        <ProfileDataProvider>
            {children}
        </ProfileDataProvider>
    );
}