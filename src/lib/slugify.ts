// src/lib/slugify.ts

/**
 * Converts a string into a URL-friendly "slug".
 * This process includes:
 * - Converting the string to lowercase.
 * - Normalizing characters to separate base letters from accents (e.g., 'é' -> 'e' + '´').
 * - Removing the separated accent marks.
 * - URL-encoding any remaining special characters to make them URL-safe.
 *
 * @param text The input string to convert (e.g., "Rosé", "j-hope", "I.M.", "&team").
 * @returns A clean, URL-safe string (e.g., "rose", "j-hope", "i.m", "%26team").
 */
export function createUrlSlug(text: string): string {
    if (!text) return '';

    // First normalize and remove diacritics
    const normalized = text
        .toLowerCase()
        .normalize('NFD') // Decomposes accented characters
        .replace(/[\u0300-\u036f]/g, ''); // Removes the accent marks (diacritics)
    
    // URL encode the result to handle special characters safely
    return encodeURIComponent(normalized);
}