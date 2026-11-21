const ROOMIE_VERCEL_PREVIEW = /^roomie-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i
const ROOMIE_VERCEL_PREVIEW_PATTERN = 'https://roomie-*.vercel.app'

export function isAllowedRoomieOrigin(origin: string | null, configured: string[]): boolean {
  if (!origin) return true
  if (configured.includes(origin)) return true
  if (!configured.includes(ROOMIE_VERCEL_PREVIEW_PATTERN)) return false
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && url.origin === origin && ROOMIE_VERCEL_PREVIEW.test(url.hostname)
  } catch {
    return false
  }
}
