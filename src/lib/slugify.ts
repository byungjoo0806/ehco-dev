// src/lib/slugify.ts

/**
 * Converts a string into a URL-friendly "slug".
 * This process includes:
 * - Converting the string to lowercase.
 * - Normalizing characters to separate base letters from accents (e.g., 'é' -> 'e' + '´').
 * - Removing the separated accent marks.
 * - Removing any remaining characters that are not lowercase letters or numbers.
 *
 * @param text The input string to convert (e.g., "Rosé", "j-hope", "I.M.").
 * @returns A clean, URL-safe string (e.g., "rose", "jhope", "im").
 */
export function createUrlSlug(text: string): string {
    if (!text) return '';

    return text
        .toLowerCase()
        .normalize('NFD') // Decomposes accented characters
        .replace(/[\u0300-\u036f]/g, '') // Removes the accent marks (diacritics)
        .replace(/[^a-z0-9]/g, ''); // Removes any remaining non-alphanumeric characters
}