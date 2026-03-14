const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export async function uploadThumbnail(
  r2: R2Bucket,
  staticUrl: string,
  sourceUrl: string,
  companySlug: string,
): Promise<string | null> {
  if (!sourceUrl) return null;

  const r2Key = `thumbnails/${companySlug}`;

  const existing = await r2.head(r2Key);
  if (existing) return `${staticUrl}/${r2Key}`;

  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 yuanchengdao-bot' },
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > 2 * 1024 * 1024) return null;

    const finalKey = `${r2Key}.${ext}`;
    await r2.put(finalKey, body, {
      httpMetadata: { contentType },
    });

    return `${staticUrl}/${finalKey}`;
  } catch (err) {
    console.error(`Failed to upload thumbnail for ${companySlug}:`, err);
    return null;
  }
}
