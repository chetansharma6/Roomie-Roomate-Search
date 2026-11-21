interface OtpResponseMetadata {
  status?: number
  retryAt?: number
}

const pending = new Map<string, OtpResponseMetadata>()

export async function captureOtpResponse<T>(email: string, send: () => Promise<T>) {
  if (pending.has(email)) throw new Error('An email link request is already in progress')
  const metadata: OtpResponseMetadata = {}
  pending.set(email, metadata)
  try {
    const result = await send()
    return { result, ...metadata }
  } finally {
    pending.delete(email)
  }
}

function retryHeaderDeadline(header: string | null, now: number): number | undefined {
  if (!header) return undefined
  const value = header.trim()
  if (/^\d+$/.test(value)) {
    const deadline = now + Number(value) * 1000
    return Number.isSafeInteger(deadline) ? deadline : undefined
  }
  if (!/^[A-Za-z]{3},/.test(value)) return undefined
  const deadline = Date.parse(value)
  return Number.isFinite(deadline) ? Math.max(now, deadline) : undefined
}

export const fetchWithOtpRetry: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  if (!pending.size || response.ok || init?.method !== 'POST' || typeof init.body !== 'string') return response
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (!url.pathname.endsWith('/auth/v1/otp')) return response

  // The SDK returns an AuthError without the original HTTP response headers.
  const { email } = JSON.parse(init.body) as { email?: string }
  const metadata = email && pending.get(email)
  if (metadata) {
    metadata.status = response.status
    metadata.retryAt = retryHeaderDeadline(response.headers.get('Retry-After'), Date.now())
  }
  return response
}
