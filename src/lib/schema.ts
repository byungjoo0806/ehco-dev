// src/lib/schema.ts
import { CelebrityData, BreadcrumbSegment, PersonSchemaData } from '@/types';

/**
 * Generates a Schema.org WebSite schema
 */
export function generateWebsiteSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "EHCO - K-Entertainment Facts & Timeline",
        "url": "https://ehco.ai",
        "potentialAction": {
            "@type": "SearchAction",
            "target": "https://ehco.ai/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
        }
    };
}

/**
 * Generates a Schema.org Person schema from celebrity data
 * @param celebrityData - The processed celebrity data
 * @param celebrityId - The celebrity ID used in the URL
 */
export function generatePersonSchema(celebrityData: CelebrityData, celebrityId: string) {
    // Build performerIn array from occupation if available
    const performerIn = celebrityData.occupation?.map(occ => {
        if (occ.toLowerCase().includes('actor') || occ.toLowerCase().includes('actress')) {
            return 'Movie';
        }
        if (occ.toLowerCase().includes('singer') || occ.toLowerCase().includes('idol')) {
            return 'MusicRecording';
        }
        if (occ.toLowerCase().includes('model')) {
            return 'Event';
        }
        return null;
    }).filter(Boolean) as string[] | undefined;

    // Create schema object
    const personSchema: PersonSchemaData = {
        name: celebrityData.name,
        alternateName: celebrityData.koreanName,
        birthDate: celebrityData.birthDate,
        nationality: celebrityData.nationality,
        affiliation: celebrityData.company,
        image: celebrityData.profilePic,
        url: `https://ehco.ai/${celebrityId}`,
        sameAs: [
            celebrityData.instagramUrl,
            celebrityData.youtubeUrl,
            celebrityData.spotifyUrl
        ].filter(Boolean) as string[],
        jobTitle: celebrityData.occupation,
        alumniOf: celebrityData.school
    };

    // Only add performerIn if we have valid values
    if (performerIn && performerIn.length > 0) {
        personSchema.performerIn = performerIn;
    }

    // Add all properties to the schema.org format
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        ...personSchema
    };
}

/**
 * Generates a Schema.org BreadcrumbList schema
 * @param segments - Array of breadcrumb segments with name and URL
 */
export function generateBreadcrumbSchema(segments: BreadcrumbSegment[]) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": segments.map((segment, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": segment.name,
            "item": segment.url
        }))
    };
}

/**
 * Generates a Schema.org Organization schema for entertainment companies
 * @param companyName - The name of the company
 */
export function generateOrganizationSchema(companyName: string) {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": companyName,
        "url": `https://ehco.ai/company/${encodeURIComponent(companyName.toLowerCase())}`,
        "industry": "Entertainment"
    };
}

/**
 * Combines multiple schema objects into a single array for JSON-LD
 * @param schemas - Array of schema objects to combine
 */
export function combineSchemas(...schemas: any[]) {
    return schemas;
}