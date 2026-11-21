/**
 * Documents HOW authenticated profiles flow into matching, using a mocked
 * Supabase REST API. No live project is contacted and no schema is created:
 * rows follow the column contract in PERSON3_SETUP.md / src/lib/profileMapper.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseRepository, verifyAccessToken } from '../api/_lib/supabase.js';
import { resetMatchState, runMatch, type MatchEnv } from '../api/_lib/matchService.js';
import type { GenerateFn } from '../api/_lib/gemini.js';
import { rowToProfile } from '../src/lib/profileMapper.js';
import type { MatchResponse } from '../src/types/profile.js';

const env: MatchEnv = {
  VITE_SUPABASE_URL: 'https://proj.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  GEMINI_API_KEY: 'k',
};

const confirmedUser = { id: 'me', email_confirmed_at: '2026-11-21T00:00:00Z' };
const userToken = 'user-jwt';

const base = {
  university_id: 'usf', bio: 'hello', budget_min: 700, budget_max: 900, distance_from_campus_miles: 2,
  move_in_date: '2027-08-01T00:00:00Z', roommates_wanted: 2, housing_status: 'need_room',
};
const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, display_name: `Student ${id}`, ...base, ...extra });

describe('rowToProfile (Supabase row -> RoommateProfile)', () => {
  it('maps a complete row, normalising housing status and date', () => {
    const p = rowToProfile(row('u1', { housing_status: 'have_room', monthly_rent: '800', cleanliness: 'tidy', smoking: 'smoke_free', verified_university_email: true }));
    expect(p).toMatchObject({ id: 'u1', housingStatus: 'has_room', monthlyRent: 800, moveInDate: '2027-08-01', cleanliness: 'tidy', verification: 'university_email_verified' });
  });

  it('treats missing or unrecognised optional values as "not provided"', () => {
    const p = rowToProfile(row('u2', { cleanliness: 'spotless', sleep_schedule: null, interests: ['a', 7, null], dealbreakers: ['no_pets', 'no_kids'], bio: null }))!;
    expect(p.cleanliness).toBeUndefined();
    expect(p.sleepSchedule).toBeUndefined();
    expect(p.interests).toEqual(['a']);
    expect(p.dealbreakers).toEqual(['no_pets']);
    expect(p.verification).toBe('unverified');
    expect(p.bio).toBe('');
  });

  it.each(['id', 'university_id', 'display_name', 'budget_min', 'budget_max', 'distance_from_campus_miles', 'move_in_date', 'roommates_wanted', 'housing_status'])(
    'returns null when required column %s is missing',
    (col) => {
      const r = row('u3') as Record<string, unknown>;
      delete r[col];
      expect(rowToProfile(r)).toBeNull();
    },
  );

  it('never copies unknown columns such as email or phone', () => {
    const p = rowToProfile(row('u4', { email: 'a@usf.edu', phone: '555-0100', auth_user_id: 'secret' }));
    expect(JSON.stringify(p)).not.toMatch(/usf\.edu|555-0100|secret/);
  });
});

describe('createSupabaseRepository (mocked REST)', () => {
  it('refuses an empty user token and rejects accounts without a confirmed email', async () => {
    expect(() => createSupabaseRepository(env, '  ')).toThrow();
    const unconfirmed = (async () => ({ ok: true, status: 200, json: async () => ({ id: 'me' }) }) as unknown as Response) as typeof fetch;
    expect(await verifyAccessToken('user-jwt', env, unconfirmed)).toBeNull();
  });

  it('queries the profiles table server-side by id / university and skips unusable rows', async () => {
    const fetchImpl = vi.fn(async (url: string | URL, ...rest: unknown[]) => {
      void rest;
      const rows = String(url).includes('limit=1') ? [row('me')] : [row('me'), row('a'), { id: 'broken' }];
      return { ok: true, status: 200, json: async () => rows } as Response;
    });
    const repo = createSupabaseRepository(env, userToken, fetchImpl as unknown as typeof fetch);
    expect((await repo.getProfile('me'))?.id).toBe('me');
    expect((await repo.listProfiles('usf')).map((p) => p.id)).toEqual(['me', 'a']); // 'broken' dropped

    const [firstUrl, init] = fetchImpl.mock.calls[0]!;
    expect(firstUrl).toContain('https://proj.supabase.co/rest/v1/profiles?id=eq.me');
    expect((init as RequestInit).headers).toEqual({
      apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${userToken}`,
    });
  });

  it('url-encodes ids so a crafted id cannot add PostgREST filters', async () => {
    const fetchImpl = vi.fn(async (...args: [string | URL, RequestInit?]) => ({ ok: true, status: 200, json: async () => [args.length] }) as unknown as Response);
    await createSupabaseRepository(env, userToken, fetchImpl as unknown as typeof fetch).getProfile('x&select=email');
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('id=eq.x%26select%3Demail');
  });

  it('verifyAccessToken sends the user token (not the secret key) to Supabase Auth', async () => {
    const fetchImpl = vi.fn(async (...args: [string | URL, RequestInit?]) => ({ ok: true, status: 200, json: async () => ({ ...confirmedUser, n: args.length }) }) as unknown as Response);
    expect(await verifyAccessToken('user-jwt', env, fetchImpl as unknown as typeof fetch)).toBe('me');
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer user-jwt');
  });
});

describe('authenticated profiles -> matching (mocked Supabase + Gemini)', () => {
  beforeEach(() => resetMatchState());

  it('loads the requester and peers from the store and sends only lifestyle fields to Gemini', async () => {
    const rows = [
      row('me', { cleanliness: 'tidy', sleep_schedule: 'early_bird', email: 'me@usf.edu', bio: 'quiet and tidy' }),
      row('peer', { cleanliness: 'tidy', sleep_schedule: 'early_bird', email: 'peer@usf.edu', display_name: 'Peer Person', major: 'Biology' }),
      row('sparse'), // only required fields: still eligible, scored on what exists
    ];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return { ok: true, status: 200, json: async () => confirmedUser } as Response;
      return { ok: true, status: 200, json: async () => (u.includes('limit=1') ? rows.slice(0, 1) : rows) } as Response;
    });
    const generate = vi.fn<GenerateFn>(async () =>
      JSON.stringify({ matches: [{ profileId: 'peer', compatibilityScore: 90, summary: 's', strengths: ['x'], potentialConflicts: [], conversationStarters: ['q'] }] }),
    );

    const out = await runMatch({
      method: 'POST', body: {}, authorization: 'Bearer user-jwt', env,
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, generate },
    });
    const json = out.json as MatchResponse;
    expect(json.source).toBe('gemini');

    const prompt = generate.mock.calls[0]![0].prompt;
    expect(prompt).toContain('"id": "peer"');
    expect(prompt).toContain('"id": "sparse"');
    expect(prompt).not.toMatch(/Peer Person|Biology|@usf\.edu|budget|move_in|2027-08/i);
    expect(JSON.stringify(json)).not.toMatch(/@usf\.edu/);
  });
});
