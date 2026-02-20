/**
 * Convert a string to a URL/email-safe kebab-case slug.
 * e.g. "Tech Club" → "tech-club"
 */
export function slugify(text) {
    return (text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric runs with hyphens
        .replace(/^-+|-+$/g, "");     // strip leading/trailing hyphens
}
