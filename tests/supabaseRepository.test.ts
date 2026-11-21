import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseRepository, isSupabaseConfigured, verifyAccessToken } from '../api/_lib/supabase.js';
import { resetMatchState, runMatch } from '../api/_lib/matchService.js';
import { rowToProfile } from '../src/lib/profileMapper.js';

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
  SUPABASE_SECRET_KEY: 'secret-must-never-be-used',
};
const row = {
  id: 'student-a', university_id: 'usf', display_name: 'Student A',
  budget_min: 500, budget_max: 900, distance_from_campus_miles: 3,
  move_in_date: '2027-08-01', roommates_wanted: 2, housing_status: 'need_room',
  verified_university_email: true, academic_year: 'graduate',
};

beforeEach(resetMatchState);

describe('user-scoped Supabase matching', () => {
  it('works without a Supabase secret key', () => {
    expect(isSupabaseConfigured({
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    })).toBe(true);
    expect(isSupabaseConfigured({})).toBe(false);
  });

  it.each([undefined, null, ''])('rejects unconfirmed Auth users (%s)', async (email_confirmed_at) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ id: 'student-a', email_confirmed_at }),
    );
    expect(await verifyAccessToken('session-token', env, fetchImpl)).toBeNull();
  });

  it('accepts confirmed users and rejects network errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ id: 'student-a', email_confirmed_at: '2026-11-21T00:00:00Z' }),
    ).mockRejectedValueOnce(new Error('offline'));
    expect(await verifyAccessToken('session-token', env, fetchImpl)).toBe('student-a');
    expect(await verifyAccessToken('session-token', env, fetchImpl)).toBeNull();
  });

  it('uses the user JWT for all profile reads and explicitly selects safe columns', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([row]));
    const repo = createSupabaseRepository(env, 'session-token', fetchImpl);
    expect((await repo.getProfile(row.id))?.id).toBe(row.id);
    expect(await repo.listProfiles('usf')).toHaveLength(1);
    for (const [input, init] of fetchImpl.mock.calls) {
      const url = new URL(String(input));
      expect(init?.headers).toEqual({ apikey: 'publishable-test', Authorization: 'Bearer session-token' });
      expect(url.searchParams.get('is_active')).toBe('eq.true');
      const columns = url.searchParams.get('select')?.split(',');
      expect(columns).toContain('verified_university_email');
      expect(columns).not.toContain('*');
      expect(columns).not.toContain('email');
      expect(JSON.stringify(init)).not.toContain(env.SUPABASE_SECRET_KEY);
    }
  });

  it('rejects empty session tokens and propagates database failures', async () => {
    expect(() => createSupabaseRepository(env, '')).toThrow('access token');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(createSupabaseRepository(env, 'session-token', fetchImpl).listProfiles('usf')).rejects.toThrow('403');
  });

  it('keeps nullable draft dates out of discovery and preserves graduate enum values', () => {
    expect(rowToProfile({ ...row, move_in_date: null })).toBeNull();
    expect(rowToProfile(row)?.academicYear).toBe('graduate');
  });

  it('maps all optional profile preferences stored for matching', () => {
    const profile = rowToProfile({
      ...row,
      monthly_rent: 850,
      room_type: 'private',
      study_environment: 'background_noise_ok',
      guest_frequency: 'sometimes',
      smoking: 'smoke_free',
      dealbreakers: ['no_pets', 'invalid'],
    });
    expect(profile).toMatchObject({
      monthlyRent: 850,
      roomType: 'private',
      studyEnvironment: 'background_noise_ok',
      guestFrequency: 'sometimes',
      smoking: 'smoke_free',
      dealbreakers: ['no_pets'],
    });
  });

  it('passes the verified caller token from matching through to database reads', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      return url.pathname.endsWith('/user')
        ? Response.json({ id: row.id, email_confirmed_at: '2026-11-21T00:00:00Z' })
        : Response.json([row]);
    });
    const out = await runMatch({ method: 'POST', body: {}, authorization: 'Bearer student-session', env, deps: { fetchImpl } });
    expect(out.status).toBe(200);
    expect(fetchImpl.mock.calls).toHaveLength(3);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer student-session', apikey: 'publishable-test' });
    }
  });
});
