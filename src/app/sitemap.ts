// src/app/sitemap.ts

import { MetadataRoute } from 'next'
import { createUrlSlug } from '@/lib/slugify';
import { fetchAllFigureIds } from '@/lib/figures'; // Import the new function

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://www.ehco.ai';

    // Use the direct fetch function - much more efficient!
    const figures = await fetchAllFigureIds();

    const figureUrls = figures.map((figure) => ({
        url: `${baseUrl}/${createUrlSlug(figure.id)}`,
        lastModified: new Date(),
    }));

    const staticUrls = [
        '/',
        '/about-ehco',
        '/all-figures',
        '/contact-us',
        '/privacy-policy',
        '/terms-of-service',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
    }));

    return [...staticUrls, ...figureUrls];
}