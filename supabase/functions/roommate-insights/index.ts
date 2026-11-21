const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
}

const minProfileLength = 20
const maxProfileLength = 4000

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function getPublishableKey() {
  const keysJson = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')

  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson) as Record<string, string>
      return keys.default ?? Object.values(keys)[0]
    } catch {
      return undefined
    }
  }

  return Deno.env.get('SUPABASE_ANON_KEY')
}

async function hasAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = getPublishableKey()

  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !publishableKey) {
    return false
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: publishableKey,
    },
  })

  return response.ok
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0)

  if (Number.isFinite(contentLength) && contentLength > 10_000) {
    return jsonResponse({ error: 'Request body is too large' }, 413)
  }

  let authenticated = false

  try {
    authenticated = await hasAuthenticatedUser(request)
  } catch {
    return jsonResponse({ error: 'Authentication service unavailable' }, 503)
  }

  if (!authenticated) {
    return jsonResponse({ error: 'Authentication required' }, 401)
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const geminiModel = Deno.env.get('GEMINI_MODEL')

  if (!geminiKey || !geminiModel) {
    return jsonResponse({ error: 'AI service is not configured' }, 503)
  }

  let profile: string

  try {
    const body = await request.json() as { profile?: unknown }
    profile = typeof body.profile === 'string' ? body.profile.trim() : ''
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (profile.length < minProfileLength || profile.length > maxProfileLength) {
    return jsonResponse(
      { error: `Profile must be between ${minProfileLength} and ${maxProfileLength} characters` },
      400,
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'You help students prepare for practical roommate conversations. Use only budget, timing, location, housing needs, and everyday living preferences supplied by the user. Never infer or use protected traits, assess trust or safety, make housing eligibility decisions, or claim compatibility is guaranteed. Return concise plain text with: a short summary, three strengths or priorities, two possible tradeoffs to discuss, and three neutral questions to ask a potential roommate. Do not use markdown tables.',
            }],
          },
          contents: [{ role: 'user', parts: [{ text: profile }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700,
          },
        }),
        signal: controller.signal,
      },
    )

    if (!geminiResponse.ok) {
      return jsonResponse({ error: 'AI service request failed' }, 502)
    }

    const geminiData = await geminiResponse.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string, thought?: boolean }> } }>
    }
    const insight = geminiData.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!insight) {
      return jsonResponse({ error: 'AI service returned no content' }, 502)
    }

    return jsonResponse({ insight })
  } catch (error) {
    const status = error instanceof DOMException && error.name === 'AbortError' ? 504 : 502
    return jsonResponse({ error: status === 504 ? 'AI service timed out' : 'AI service unavailable' }, status)
  } finally {
    clearTimeout(timeout)
  }
})
