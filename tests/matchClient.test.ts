import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PROFILES, DEMO_STUDENT } from '../src/data/demoProfiles.js';
import { MatchClientError, clearMatchCache, findMatches } from '../src/lib/matchClient.js';

const good = {
  source: 'gemini', model: 'm', disclaimer: 'estimates',
  matches: [{ profileId: 'demo-maya', compatibilityScore: 92, summary: 's', strengths: ['x'], potentialConflicts: [], conversationStarters: ['q'] }],
};
const resp = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
const params = (fetchImpl: unknown, extra = {}) => ({ requester: DEMO_STUDENT, candidates: DEMO_PROFILES, fetchImpl: fetchImpl as typeof fetch, ...extra });

beforeEach(() => clearMatchCache());

describe('findMatches', () => {
  it('returns Gemini results from the API', async () => {
    const r = await findMatches(params(vi.fn().mockResolvedValue(resp(200, good))));
    expect(r.source).toBe('gemini');
  });
  it('sends the bearer token and never a user id when authenticated', async () => {
    const f = vi.fn().mockResolvedValue(resp(200, good));
    await findMatches(params(f, { accessToken: 'tok' }));
    const init = f.mock.calls[0]![1];
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).not.toHaveProperty('demoStudentId');
  });
  it('throws a user-facing error when the profile is missing', async () => {
    await expect(findMatches({ requester: null, candidates: [] })).rejects.toBeInstanceOf(MatchClientError);
    await expect(findMatches(params(vi.fn().mockResolvedValue(resp(404, {}))))).rejects.toMatchObject({ kind: 'missing_profile' });
  });
  it('returns an empty list without calling the API when filters exclude everyone', async () => {
    const f = vi.fn();
    const r = await findMatches(params(f, { filters: { maxMonthlyBudget: 1 } }));
    expect(r.matches).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    ['429', () => Promise.resolve(resp(429, {})), 'rate_limited'],
    ['500', () => Promise.resolve(resp(500, {})), 'server_error'],
    ['network error', () => Promise.reject(new TypeError('fetch failed')), 'network_error'],
    ['malformed JSON shape', () => Promise.resolve(resp(200, { matches: 'nope' })), 'invalid_ai_response'],
  ])('falls back locally on %s', async (_n, impl, reason) => {
    const r = await findMatches(params(vi.fn(impl)));
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe(reason);
    expect(r.matches.length).toBeGreaterThan(0);
  });
  it('falls back on client timeout', async () => {
    const f = (_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const r = await findMatches(params(f, { timeoutMs: 20 }));
    expect(r.fallbackReason).toBe('timeout');
  });
  it('drops matches for profiles the client never offered', async () => {
    const bad = { ...good, matches: [...good.matches, { ...good.matches[0]!, profileId: 'demo-priya' }] };
    const r = await findMatches(params(vi.fn().mockResolvedValue(resp(200, bad))));
    expect(r.matches.map((m) => m.profileId)).toEqual(['demo-maya']);
  });
  it('reuses cached Gemini results and shares in-flight requests', async () => {
    const f = vi.fn().mockResolvedValue(resp(200, good));
    await Promise.all([findMatches(params(f)), findMatches(params(f))]);
    await findMatches(params(f));
    expect(f).toHaveBeenCalledTimes(1);
    await findMatches(params(f, { filters: { maxDistanceMiles: 2.5 } }));
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('does not cache fallback responses', async () => {
    const f = vi.fn().mockResolvedValue(resp(500, {}));
    await findMatches(params(f));
    await findMatches(params(f));
    expect(f).toHaveBeenCalledTimes(2);
  });
});
