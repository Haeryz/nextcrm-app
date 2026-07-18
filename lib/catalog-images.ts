/**
 * Resolve a stored catalog image path to a browser-usable src.
 *
 * Must be filesystem-free: on Vercel, `public/` assets are served by the CDN
 * and are NOT readable via `fs` from the serverless runtime, so any runtime
 * `fs.existsSync` check would wrongly null every image in production. We only
 * validate the shape here and let the <img> onError fallback handle a genuinely
 * missing file.
 */
export function getExistingCatalogImagePath(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;

  const normalized = imagePath.replace(/\\/g, "/");
  // Only allow the known static catalog image directory; block traversal.
  if (normalized.includes("..")) return null;
  if (
    !normalized.startsWith("/catalog/images/") &&
    !/^\/api\/mektek\/catalog-items\/[^/]+\/image$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function getCatalogImageSource(input: {
  id: string;
  imageMimeType?: string | null;
  imagePath?: string | null;
}) {
  if (input.imageMimeType) {
    return `/api/mektek/catalog-items/${encodeURIComponent(input.id)}/image`;
  }

  return getExistingCatalogImagePath(input.imagePath ?? null);
}
