import { filterCandidates } from './filters.js';
import { matchResponseSchema } from './matchSchema.js';
import { rankBaseline } from './scoring.js';
import {
  SCORE_DISCLAIMER,
  type FallbackReason,
  type MatchResponse,
  type ProfileFilters,
  type RoommateProfile,
} from '../types/profile.js';

export const CLIENT_TIMEOUT_MS = 25_000;

/** Thrown only for problems the user must fix (no fallback can help). */
export class MatchClientError extends Error {
  constructor(
    public readonly kind: 'missing_profile' | 'unauthorized' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'MatchClientError';
  }
}

export interface FindMatchesParams {
  /** The signed-in student's profile. */
  requester: RoommateProfile | null | undefined;
  /** Profiles available locally (demo data, or rows loaded from Supabase) for filtering and fallback. */
  candidates: RoommateProfile[];
  filters?: ProfileFilters;
  /** Supabase access token; omit in demo mode. */
  accessToken?: string;
  /** Demo mode only: server ignores it unless ROOMIE_DEMO_MODE is enabled. */
  demoStudentId?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const cache = new Map<string, MatchResponse>();
const inflight = new Map<string, Promise<MatchResponse>>();

export function clearMatchCache(): void {
  cache.clear();
  inflight.clear();
}

function localFallback(requester: RoommateProfile, eligible: RoommateProfile[], reason: FallbackReason): MatchResponse {
  return { source: 'fallback', fallbackReason: reason, matches: rankBaseline(requester, eligible), disclaimer: SCORE_DISCLAIMER };
}

export function describeFallback(reason?: FallbackReason): string {
  switch (reason) {
    case 'no_api_key':
      return 'Gemini is not configured on this server, so these are baseline matches.';
    case 'rate_limited':
      return 'Gemini is busy right now (rate limit), so these are baseline matches.';
    case 'unavailable':
      return 'Gemini is temporarily overloaded, so these are baseline matches. Try again in a moment.';
    case 'timeout':
      return 'Gemini took too long to respond, so these are baseline matches.';
    case 'invalid_ai_response':
      return 'Gemini returned an unusable answer, so these are baseline matches.';
    case 'network_error':
      return 'Could not reach the matching service, so these are baseline matches.';
    default:
      return 'AI analysis is unavailable right now, so these are baseline matches.';
  }
}

/**
 * Applies hard filters locally, asks /api/match for Gemini analysis, and falls
 * back to deterministic scoring on any failure. Repeated calls with unchanged
 * inputs reuse the previous Gemini result and share any in-flight request.
 */
export async function findMatches(params: FindMatchesParams): Promise<MatchResponse> {
  const { requester, candidates, filters = {}, accessToken, demoStudentId, endpoint = '/api/match', signal } = params;
  // Server-resolved mode: signed in but no local profile data. The server verifies the
  // token, loads the student and candidates, and returns the cards to display.
  if (!requester && accessToken) return findMatchesViaServer({ ...params, filters });
  if (!requester) throw new MatchClientError('missing_profile', 'Create your profile before searching for matches.');

  const eligible = filterCandidates(candidates, { ...filters, universityId: requester.universityId }, requester);
  if (eligible.length === 0) return { source: 'fallback', matches: [], disclaimer: SCORE_DISCLAIMER };

  const key = JSON.stringify([requester, filters, eligible.map((c) => c.id), demoStudentId ?? null]);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const run = (async (): Promise<MatchResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? CLIENT_TIMEOUT_MS);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    try {
      const res = await (params.fetchImpl ?? fetch)(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ filters, ...(demoStudentId ? { demoStudentId } : {}) }),
        signal: controller.signal,
      });
      if (res.status === 404) throw new MatchClientError('missing_profile', 'Create your profile before searching for matches.');
      if (res.status === 401) throw new MatchClientError('unauthorized', 'Please sign in to find matches.');
      if (res.status === 429) return localFallback(requester, eligible, 'rate_limited');
      if (!res.ok) return localFallback(requester, eligible, 'server_error');

      const parsed = matchResponseSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) return localFallback(requester, eligible, 'invalid_ai_response');
      const eligibleIds = new Set(eligible.map((c) => c.id));
      const matches = parsed.data.matches.filter((m) => eligibleIds.has(m.profileId));
      const response: MatchResponse = { ...parsed.data, matches };
      if (response.source === 'gemini' && matches.length > 0) cache.set(key, response);
      return response;
    } catch (e) {
      if (e instanceof MatchClientError) throw e;
      if (signal?.aborted) throw e;
      const timedOut = e instanceof Error && e.name === 'AbortError';
      return localFallback(requester, eligible, timedOut ? 'timeout' : 'network_error');
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, run);
  return run;
}

async function findMatchesViaServer(params: FindMatchesParams): Promise<MatchResponse> {
  const { filters = {}, accessToken, endpoint = '/api/match', signal } = params;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? CLIENT_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const res = await (params.fetchImpl ?? fetch)(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ filters }),
      signal: controller.signal,
    });
    if (res.status === 404) throw new MatchClientError('missing_profile', 'Create your profile before searching for matches.');
    if (res.status === 401) throw new MatchClientError('unauthorized', 'Please sign in again to find matches.');
    if (res.status === 429) throw new MatchClientError('unavailable', 'Too many match requests. Please wait a minute and try again.');
    if (!res.ok) throw new MatchClientError('unavailable', 'Matching is unavailable right now. Please try again shortly.');
    const parsed = matchResponseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new MatchClientError('unavailable', 'Matching returned an unexpected response. Please try again.');
    const known = new Set((parsed.data.profiles ?? []).map((p) => p.id));
    return { ...parsed.data, matches: parsed.data.matches.filter((m) => known.has(m.profileId)) };
  } catch (e) {
    if (e instanceof MatchClientError) throw e;
    if (signal?.aborted) throw e;
    throw new MatchClientError('unavailable', 'Could not reach the matching service. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
