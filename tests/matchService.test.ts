import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runMatch, isDemoModeEnabled, resetMatchState, type MatchEnv } from '../api/_lib/matchService.js';
import type { GenerateFn } from '../api/_lib/gemini.js';
import { DEMO_STUDENT_ID } from '../src/data/demoProfiles.js';
import type { MatchResponse } from '../src/types/profile.js';

const demoEnv: MatchEnv = { ROOMIE_DEMO_MODE: 'true', GEMINI_API_KEY: 'test-key' };
const okMatch = (profileId: string) => ({
  profileId, compatibilityScore: 88, summary: 'Similar routines.', strengths: ['Quiet home'], potentialConflicts: [], conversationStarters: ['Chore split?'],
});
const geminiFor = (...ids: string[]): GenerateFn => async () => JSON.stringify({ matches: ids.map(okMatch) });

beforeEach(() => resetMatchState());

describe('demo mode gating', () => {
  it.each([
    [{ ROOMIE_DEMO_MODE: 'true' }, true],
    [{ ROOMIE_DEMO_MODE: 'true', VERCEL_ENV: 'preview' }, true],
    [{}, false],
    [{ ROOMIE_DEMO_MODE: 'false' }, false],
    [{ ROOMIE_DEMO_MODE: 'true', VERCEL_ENV: 'production' }, false],
    [{ ROOMIE_DEMO_MODE: 'true', NODE_ENV: 'production' }, false],
  ] as [MatchEnv, boolean][])('%j -> %s', (env, expected) => {
    expect(isDemoModeEnabled(env)).toBe(expected);
  });

  it('refuses unauthenticated calls when demo mode is off (cannot impersonate)', async () => {
    const out = await runMatch({ method: 'POST', body: { demoStudentId: DEMO_STUDENT_ID }, env: { GEMINI_API_KEY: 'k', VERCEL_ENV: 'production', ROOMIE_DEMO_MODE: 'true' } });
    expect(out.status).toBe(503);
    const out2 = await runMatch({
      method: 'POST', body: { demoStudentId: DEMO_STUDENT_ID },
      env: { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'a', SUPABASE_SECRET_KEY: 's', VERCEL_ENV: 'production', ROOMIE_DEMO_MODE: 'true' },
    });
    expect(out2.status).toBe(401);
  });

  it('rejects an invalid Supabase token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const out = await runMatch({
      method: 'POST', body: {}, authorization: 'Bearer bad',
      env: { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'a', SUPABASE_SECRET_KEY: 's' },
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch },
    });
    expect(out.status).toBe(401);
  });
});

describe('input validation', () => {
  it('rejects non-POST, unknown keys, and out-of-range filters', async () => {
    expect((await runMatch({ method: 'GET', body: {}, env: demoEnv })).status).toBe(405);
    expect((await runMatch({ method: 'POST', body: { userId: 'someone-else' }, env: demoEnv })).status).toBe(400);
    expect((await runMatch({ method: 'POST', body: { filters: { maxMonthlyBudget: -5 } }, env: demoEnv })).status).toBe(400);
    expect((await runMatch({ method: 'POST', body: { filters: { housingStatus: 'castle' } }, env: demoEnv })).status).toBe(400);
    expect((await runMatch({ method: 'POST', body: 'garbage', env: demoEnv })).status).toBe(400);
  });
  it('returns 404 for a missing profile', async () => {
    expect((await runMatch({ method: 'POST', body: { demoStudentId: 'nobody' }, env: demoEnv })).status).toBe(404);
  });
});

describe('matching flow', () => {
  it('returns Gemini results labelled as gemini, never including the requester or filtered-out profiles', async () => {
    const generate = vi.fn(geminiFor('demo-maya', 'demo-tyler'));
    const out = await runMatch({ method: 'POST', body: {}, env: demoEnv, deps: { generate } });
    const body = out.json as MatchResponse;
    expect(out.status).toBe(200);
    expect(body.source).toBe('gemini');
    const prompt = generate.mock.calls[0]![0].prompt.split('<candidate_data')[1]!;
    for (const excluded of ['demo-cole', 'demo-priya', 'demo-grace', DEMO_STUDENT_ID]) expect(prompt).not.toContain(`"${excluded}"`);
    expect(JSON.stringify(body)).not.toContain('API');
  });
  it('falls back (labelled) with no API key', async () => {
    const out = await runMatch({ method: 'POST', body: {}, env: { ROOMIE_DEMO_MODE: 'true' } });
    const body = out.json as MatchResponse;
    expect(body.source).toBe('fallback');
    expect(body.fallbackReason).toBe('no_api_key');
    expect(body.matches.length).toBeGreaterThan(3);
  });
  it.each([
    ['invalid AI output', async () => 'not json', 'invalid_ai_response'],
    ['hallucinated id', geminiFor('demo-ghost'), 'invalid_ai_response'],
    ['rate limit', async () => { throw Object.assign(new Error('x'), { status: 429 }); }, 'rate_limited'],
    ['provider error', async () => { throw new Error('x'); }, 'ai_error'],
  ] as [string, GenerateFn, string][])('falls back on %s', async (_n, generate, reason) => {
    const out = await runMatch({ method: 'POST', body: {}, env: demoEnv, deps: { generate } });
    const body = out.json as MatchResponse;
    expect(body.source).toBe('fallback');
    expect(body.fallbackReason).toBe(reason);
    expect(body.matches.length).toBeGreaterThan(0);
  });
  it('falls back on timeout', async () => {
    const generate: GenerateFn = () => new Promise(() => {});
    const out = await runMatch({ method: 'POST', body: {}, env: demoEnv, deps: { generate, timeoutMs: 20 } });
    expect((out.json as MatchResponse).fallbackReason).toBe('timeout');
  });
  it('applies filters and returns an empty result without calling Gemini', async () => {
    const generate = vi.fn(geminiFor('demo-maya'));
    const out = await runMatch({ method: 'POST', body: { filters: { maxMonthlyBudget: 100 } }, env: demoEnv, deps: { generate } });
    expect((out.json as MatchResponse).matches).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
  it('ignores a client-sent universityId override', async () => {
    const generate = vi.fn(geminiFor('demo-maya'));
    await runMatch({ method: 'POST', body: { filters: { universityId: 'ucf' } }, env: demoEnv, deps: { generate } });
    expect(generate.mock.calls[0]![0].prompt).not.toContain('"demo-grace"');
  });
  it('does not repeat Gemini calls for unchanged input', async () => {
    const generate = vi.fn(geminiFor('demo-maya'));
    await runMatch({ method: 'POST', body: {}, env: demoEnv, deps: { generate } });
    const again = await runMatch({ method: 'POST', body: {}, env: demoEnv, deps: { generate } });
    expect(generate).toHaveBeenCalledTimes(1);
    expect((again.json as MatchResponse).source).toBe('gemini');
  });
  it('rate limits repeated callers', async () => {
    let last = 200;
    for (let i = 0; i < 11; i++) last = (await runMatch({ method: 'POST', body: {}, env: { ROOMIE_DEMO_MODE: 'true' } })).status;
    expect(last).toBe(429);
  });
});
