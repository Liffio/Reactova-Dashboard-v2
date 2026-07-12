/**
 * Lyra's vision-capable tasks take base64 data URLs, but this app's media
 * uploads already live on the backend as plain URLs (no client-side File/blob
 * kept around). These helpers re-fetch an already-uploaded image and convert
 * it to a data URL on demand, best-effort — a failed conversion is dropped
 * rather than blocking the caller's Lyra request.
 */

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** Converts up to `max` URLs (Lyra caps images at 4 per request) to data URLs, silently dropping failures. */
export async function urlsToDataUrls(urls: string[], max = 4): Promise<string[]> {
  const picked = urls
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, max);
  const results = await Promise.all(picked.map((u) => urlToDataUrl(u)));
  return results.filter((r): r is string => Boolean(r));
}
