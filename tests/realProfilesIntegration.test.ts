import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runMatch, resetMatchState, type MatchEnv } from '../api/_lib/matchService.js';
import type { GenerateFn } from '../api/_lib/gemini.js';
import { PROFILE_COLUMNS } from '../src/lib/profiles.js';
import { rowToProfile } from '../src/lib/profileMapper.js';
import type { MatchResponse } from '../src/types/profile.js';

// Mocked Supabase REST only: no live project is contacted.
const env: MatchEnv = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'pub', GEMINI_API_KEY: 'k' };
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id, university: 'University of South Florida', university_id: 'usf', display_name: `S ${id}`, bio: 'hi',
  budget_min: 700, budget_max: 900, distance_from_campus_miles: 2, move_in_date: '2027-08-01',
  roommates_wanted: 1, housing_status: 'need_room', verified_university_email: true, is_active: true,
  photo_url: null, monthly_rent: null, room_type: null, interests: null, dealbreakers: null, ...extra,
});

function store(rows: Record<string, unknown>[], opts: { userId?: string | null; dbStatus?: number } = {}) {
  const userId = opts.userId === undefined ? 'me' : opts.userId;
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return userId ? ({ ok: true, status: 200, json: async () => ({ id: userId, email_confirmed_at: '2026-11-21T00:00:00Z' }) } as Response) : ({ ok: false, status: 401 } as Response);
    }
    if (opts.dbStatus) return { ok: false, status: opts.dbStatus, json: async () => ({}) } as Response;
    const q = new URL(u).searchParams;
    const id = q.get('id'); const uni = q.get('university_id');
    return { ok: true, status: 200, json: async () => rows.filter((r) => (id ? `eq.${r.id}` === id : `eq.${r.university_id}` === uni)) } as Response;
  }) as unknown as typeof fetch;
}
const gen = (...ids: string[]): GenerateFn => async () =>
  JSON.stringify({ matches: ids.map((profileId) => ({ profileId, compatibilityScore: 80, summary: 's', strengths: ['x'], potentialConflicts: [], conversationStarters: ['q'] })) });
const post = (fetchImpl: typeof fetch, body: unknown = {}, extra: Partial<Parameters<typeof runMatch>[0]> = {}) =>
  runMatch({ method: 'POST', body, authorization: 'Bearer t', env, deps: { fetchImpl, generate: gen() }, ...extra });

beforeEach(() => resetMatchState());

describe('real Supabase profiles -> matching', () => {
  it('maps every column the browser listProfiles() selects, without inventing missing values', () => {
    const selected = PROFILE_COLUMNS.split(',');
    const full = Object.fromEntries(selected.map((c) => [c, null]));
    const p = rowToProfile({ ...full, ...row('a'), photo_url: null });
    expect(p).toMatchObject({ id: 'a', universityId: 'usf', housingStatus: 'needs_room', moveInDate: '2027-08-01', verification: 'university_email_verified' });
    expect(p?.monthlyRent).toBeUndefined();
    expect(p?.cleanliness).toBeUndefined();
    expect(p?.photoUrl).toBeUndefined();
  });

  it('drops rows missing a move-in date (draft profiles) and unverified flags default to unverified', () => {
    expect(rowToProfile(row('a', { move_in_date: null }))).toBeNull();
    expect(rowToProfile(row('a', { verified_university_email: false }))?.verification).toBe('unverified');
  });

  it('returns 401 without an Authorization header and when Supabase rejects the token', async () => {
    expect((await post(store([]), {}, { authorization: undefined })).status).toBe(401);
    expect((await post(store([row('me')], { userId: null }))).status).toBe(401);
  });

  it('returns 404 when the signed-in student has no (active) profile', async () => {
    expect((await post(store([row('a')]))).status).toBe(404);
  });

  it('returns an empty result when the student is the only profile', async () => {
    const out = await post(store([row('me')]));
    expect(out.status).toBe(200);
    expect((out.json as MatchResponse).matches).toEqual([]);
  });

  it('returns 502 (not a crash or fake data) when the database errors', async () => {
    const out = await post(store([row('me')], { dbStatus: 500 }));
    expect(out.status).toBe(502);
    expect(JSON.stringify(out.json)).not.toMatch(/500|pub/);
  });

  it('applies the housing filter, then sends only the eligible candidates to Gemini', async () => {
    const rows = [row('me'), row('room', { housing_status: 'have_room', monthly_rent: 800 }), row('need')];
    const generate = vi.fn(gen('need'));
    const out = await post(store(rows), { filters: { housingStatus: 'needs_room' } }, { deps: { fetchImpl: store(rows), generate } });
    const json = out.json as MatchResponse;
    expect(json.source).toBe('gemini');
    expect(json.profiles?.map((p) => p.id)).toEqual(['need']);
    const prompt = generate.mock.calls[0]![0].prompt;
    expect(prompt).toContain('"id": "need"');
    expect(prompt).not.toContain('"id": "room"');
  });

  it('falls back to baseline on Gemini failure and never leaks contact data', async () => {
    const rows = [row('me'), row('a', { email: 'a@usf.edu', phone: '555-0100' })];
    const failing: GenerateFn = async () => { throw new Error('boom'); };
    const out = await post(store(rows), {}, { deps: { fetchImpl: store(rows), generate: failing } });
    const json = out.json as MatchResponse;
    expect(json.source).toBe('fallback');
    expect(json.matches.map((m) => m.profileId)).toEqual(['a']);
    expect(JSON.stringify(json)).not.toMatch(/@usf\.edu|555-0100/);
  });

  it('ignores a client-supplied user id or university', async () => {
    const rows = [row('me'), row('a'), row('x', { university_id: 'ucf' })];
    const out = await post(store(rows), { demoStudentId: 'x', filters: { universityId: 'ucf' } });
    expect(out.status === 400 || (out.json as MatchResponse).profiles?.every((p) => p.universityId === 'usf')).toBe(true);
  });
});
