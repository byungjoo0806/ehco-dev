// src/types/index.ts

import { Timestamp } from 'firebase/firestore';

// Interface for Firestore data (raw data before processing)
export interface FirestoreCelebrityData {
    name: string;
    koreanName: string;
    profilePic: string;
    birthDate: Timestamp;
    debutDate?: string;
    nationality: string;
    company: string;
    youtubeUrl?: string;
    instagramUrl?: string;
    spotifyUrl?: string;
    school?: string[];
    occupation?: string[];
    group?: string;
    zodiacSign?: string;
    chineseZodiac?: string;
}

// Interface for processed data (after timestamp conversion)
export interface CelebrityData extends Omit<FirestoreCelebrityData, 'birthDate'> {
    birthDate: string;  // birthDate is converted to string
}

// Key Work interface for special content
export interface KeyWork {
    description: string;
    year: string;
    source: string;
}

export interface RegularContent {
    id: string;
    subcategory: string;
    subcategory_overview: string;
    source_articles: string[];
    chronological_developments: string;
}

export interface SpecialContent {
    id: string;
    key_works?: {
        [key: string]: Array<KeyWork>;
    };
    overall_overview?: string;
}

export interface CelebrityContentData {
    regularContent: RegularContent[];
    specialContent: SpecialContent[];
}

// Schema Data Types
export interface BreadcrumbSegment {
    name: string;
    url: string;
}

// Additional Schema-specific types
export interface PersonSchemaData {
    name: string;
    alternateName?: string;
    birthDate: string;
    nationality?: string;
    affiliation?: string;
    image?: string;
    url: string;
    sameAs?: string[];
    jobTitle?: string[];
    description?: string;
    performerIn?: string[];
    alumniOf?: string[];
}