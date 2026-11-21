import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runMatch, resetMatchState, type MatchEnv } from '../api/_lib/matchService.js';
import type { GenerateFn } from '../api/_lib/gemini.js';
import { MatchClientError, clearMatchCache, findMatches } from '../src/lib/matchClient.js';
import type { MatchResponse } from '../src/types/profile.js';

// Mocked Supabase REST: no live project is contacted by these tests.
const env: MatchEnv = {
  VITE_SUPABASE_URL: 'https://x.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'pub',
  SUPABASE_SECRET_KEY: 'secret',
  GEMINI_API_KEY: 'k',
};
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id, university_id: 'usf', display_name: `Student ${id}`, bio: 'hi', budget_min: 700, budget_max: 900,
  distance_from_campus_miles: 2, move_in_date: '2027-08-01', roommates_wanted: 2, housing_status: 'need_room',
  verified_university_email: true, cleanliness: 'tidy', sleep_schedule: 'early_bird',
  email: `${id}@usf.edu`, phone: '555-0100', ...extra,
});
const ROWS = [row('me'), row('a'), row('b'), row('far', { distance_from_campus_miles: 40 }), row('other-uni', { university_id: 'ucf' })];

function supabaseFetch(userId: string | null) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) return userId ? ({ ok: true, status: 200, json: async () => ({ id: userId, email_confirmed_at: '2026-11-21T00:00:00Z' }) } as Response) : ({ ok: false, status: 401 } as Response);
    const q = new URL(u).searchParams;
    const idEq = q.get('id'); const uniEq = q.get('university_id');
    const data = idEq ? ROWS.filter((r) => `eq.${r.id}` === idEq) : ROWS.filter((r) => `eq.${r.university_id}` === uniEq);
    return { ok: true, status: 200, json: async () => data } as Response;
  }) as unknown as typeof fetch;
}
const okMatch = (profileId: string) => ({ profileId, compatibilityScore: 90, summary: 's', strengths: ['x'], potentialConflicts: [], conversationStarters: ['q'] });
const gemini = (...ids: string[]): GenerateFn => async () => JSON.stringify({ matches: ids.map(okMatch) });

beforeEach(() => { resetMatchState(); clearMatchCache(); });

describe('authenticated /api/match (mocked Supabase)', () => {
  it('uses the id from the verified token, applies hard filters, and returns sanitized cards', async () => {
    const out = await runMatch({
      method: 'POST', body: { filters: { maxDistanceMiles: 10 } }, authorization: 'Bearer good', env,
      deps: { fetchImpl: supabaseFetch('me'), generate: gemini('a', 'b') },
    });
    expect(out.status).toBe(200);
    const json = out.json as MatchResponse;
    expect(json.source).toBe('gemini');
    expect(json.matches.map((m) => m.profileId).sort()).toEqual(['a', 'b']);
    expect(json.profiles?.map((p) => p.id).sort()).toEqual(['a', 'b']); // no self, no far, no other university
    expect(JSON.stringify(json)).not.toMatch(/@usf\.edu|555-0100/);
  });

  it('falls back to baseline (with cards) when Gemini returns hallucinated ids', async () => {
    const out = await runMatch({
      method: 'POST', body: {}, authorization: 'Bearer good', env,
      deps: { fetchImpl: supabaseFetch('me'), generate: gemini('ghost') },
    });
    const json = out.json as MatchResponse;
    expect(json.source).toBe('fallback');
    expect(json.fallbackReason).toBe('invalid_ai_response');
    expect(json.profiles?.length).toBe(json.matches.length);
  });

  it('falls back when no Gemini key is configured', async () => {
    const out = await runMatch({ method: 'POST', body: {}, authorization: 'Bearer good', env: { ...env, GEMINI_API_KEY: undefined }, deps: { fetchImpl: supabaseFetch('me') } });
    expect((out.json as MatchResponse).fallbackReason).toBe('no_api_key');
  });

  it('returns 404 for a signed-in student without a profile row', async () => {
    const out = await runMatch({ method: 'POST', body: {}, authorization: 'Bearer good', env, deps: { fetchImpl: supabaseFetch('no-profile') } });
    expect(out.status).toBe(404);
  });

  it('returns 401 for an invalid token and ignores demoStudentId', async () => {
    const out = await runMatch({ method: 'POST', body: { demoStudentId: 'me' }, authorization: 'Bearer bad', env, deps: { fetchImpl: supabaseFetch(null) } });
    expect(out.status).toBe(401);
  });

  it('returns an empty result when no eligible roommates remain', async () => {
    const out = await runMatch({ method: 'POST', body: { filters: { maxMonthlyBudget: 100 } }, authorization: 'Bearer good', env, deps: { fetchImpl: supabaseFetch('me') } });
    expect(out.status).toBe(200);
    expect((out.json as MatchResponse).matches).toEqual([]);
  });
});

describe('findMatches in server-resolved mode', () => {
  const card = { id: 'a', universityId: 'usf', displayName: 'A', bio: '', budgetMin: 1, budgetMax: 2, distanceFromCampusMiles: 1, moveInDate: '2027-08-01', roommatesWanted: 1, housingStatus: 'needs_room', verification: 'unverified' };
  const body = { source: 'gemini', model: 'm', disclaimer: 'd', matches: [okMatch('a'), okMatch('ghost')], profiles: [card] };
  const resp = (status: number, b: unknown) => ({ ok: status < 400, status, json: async () => b }) as Response;

  it('sends only the bearer token and drops matches without a returned card', async () => {
    const f = vi.fn().mockResolvedValue(resp(200, body));
    const r = await findMatches({ requester: null, candidates: [], accessToken: 'tok', fetchImpl: f as unknown as typeof fetch });
    expect(r.matches.map((m) => m.profileId)).toEqual(['a']);
    expect(f.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ filters: {} });
  });
  it.each([[404, 'missing_profile'], [401, 'unauthorized'], [500, 'unavailable'], [429, 'unavailable']])('status %i -> %s', async (status, kind) => {
    await expect(findMatches({ requester: null, candidates: [], accessToken: 't', fetchImpl: vi.fn().mockResolvedValue(resp(status, {})) as unknown as typeof fetch })).rejects.toMatchObject({ kind });
  });
  it('rejects a malformed payload and network failures with a user-facing error', async () => {
    await expect(findMatches({ requester: null, candidates: [], accessToken: 't', fetchImpl: vi.fn().mockResolvedValue(resp(200, { nope: 1 })) as unknown as typeof fetch })).rejects.toBeInstanceOf(MatchClientError);
    await expect(findMatches({ requester: null, candidates: [], accessToken: 't', fetchImpl: vi.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch })).rejects.toBeInstanceOf(MatchClientError);
  });
});
