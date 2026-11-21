import { beforeEach, describe, expect, it } from 'vitest';
import { runMatch, resetMatchState, type MatchEnv } from '../api/_lib/matchService.js';
import type { GenerateFn } from '../api/_lib/gemini.js';
import { ADVERSARIAL_TEST_PROFILES, DEMO_PROFILES, DEMO_STUDENT, DEMO_STUDENT_ID } from '../src/data/demoProfiles.js';
import { CONFLICT_CAPS, baselineMatch, scoreCompatibility } from '../src/lib/scoring.js';
import type { MatchResponse, RoommateProfile } from '../src/types/profile.js';
import { makeProfile } from './helpers.js';

const lifestyle: Partial<RoommateProfile> = {
  cleanliness: 'tidy', sleepSchedule: 'early_bird', noiseTolerance: 'quiet', studyEnvironment: 'quiet',
  guestFrequency: 'sometimes', petPreference: 'pets_ok', smoking: 'smoke_free', interests: ['hiking', 'cooking', 'coding'],
};
const me = makeProfile({ id: 'me', ...lifestyle });
const other = (o: Partial<RoommateProfile>) => makeProfile({ id: 'o', ...lifestyle, ...o });
const score = (a: RoommateProfile, b: RoommateProfile) => scoreCompatibility(a, b).score;

describe('baseline accuracy scenarios (fictional students)', () => {
  it('1. nearly identical preferences are a strong match', () => {
    expect(score(me, other({ guestFrequency: 'rarely' }))).toBeGreaterThanOrEqual(90);
  });

  it('2-4. conflicting sleep, cleanliness and noise each lower the score; extremes cannot be a strong match', () => {
    const base = score(me, other({}));
    expect(score(me, other({ sleepSchedule: 'night_owl' }))).toBeLessThanOrEqual(CONFLICT_CAPS.core);
    expect(score(me, other({ noiseTolerance: 'lively' }))).toBeLessThanOrEqual(CONFLICT_CAPS.core);
    expect(score(me, other({ cleanliness: 'relaxed' }))).toBeLessThan(base);
    expect(score(makeProfile({ ...lifestyle, cleanliness: 'very_tidy' }), other({ cleanliness: 'relaxed' }))).toBeLessThanOrEqual(CONFLICT_CAPS.core);
  });

  it('5. never-guests vs often-guests is a core conflict; sometimes vs often is not', () => {
    expect(score(makeProfile({ ...lifestyle, guestFrequency: 'never' }), other({ guestFrequency: 'often' }))).toBeLessThanOrEqual(CONFLICT_CAPS.core);
    expect(score(me, other({ guestFrequency: 'often' }))).toBeGreaterThan(CONFLICT_CAPS.core);
  });

  it('6. pet-free vs pet owner, and smoke-free vs smoker, are capped even without a declared dealbreaker', () => {
    expect(score(makeProfile({ ...lifestyle, petPreference: 'no_pets' }), other({ petPreference: 'has_pets' }))).toBeLessThanOrEqual(CONFLICT_CAPS.direct);
    expect(score(me, other({ smoking: 'smoker' }))).toBeLessThanOrEqual(CONFLICT_CAPS.direct);
    expect(baselineMatch(me, other({ smoking: 'smoker' })).potentialConflicts.join(' ')).toMatch(/smoking/i);
  });

  it('7. a profile with almost no optional data is not rated a strong match', () => {
    const sparse = makeProfile({ id: 's' }); // required fields only
    const s = score(me, sparse);
    expect(s).toBeGreaterThan(35);
    expect(s).toBeLessThan(70);
    expect(baselineMatch(me, sparse).strengths.length).toBeGreaterThan(0);
  });

  it('8. shared hobbies cannot rescue incompatible living habits', () => {
    const hobbyTwin = other({ cleanliness: 'relaxed', sleepSchedule: 'night_owl', noiseTolerance: 'lively', guestFrequency: 'often' });
    const quietNoHobbies = other({ interests: ['knitting'] });
    expect(score(me, hobbyTwin)).toBeLessThan(score(me, quietNoHobbies));
    expect(score(me, hobbyTwin)).toBeLessThan(60);
  });

  it('keeps the demo ordering sensible', () => {
    const byId = (id: string) => DEMO_PROFILES.find((p) => p.id === id)!;
    expect(score(DEMO_STUDENT, byId('demo-maya'))).toBeGreaterThan(90);
    expect(score(DEMO_STUDENT, byId('demo-tyler'))).toBeLessThan(60);
  });

  it('keeps prompt-injection profiles out of the normal demo pool', () => {
    const demoIds = new Set(DEMO_PROFILES.map((p) => p.id));
    for (const p of ADVERSARIAL_TEST_PROFILES) expect(demoIds.has(p.id)).toBe(false);
  });
});

// ---- Gemini reliability through the whole /api/match pipeline (mocked model) ----
const env: MatchEnv = { ROOMIE_DEMO_MODE: 'true', GEMINI_API_KEY: 'test-key' };
const body = { demoStudentId: DEMO_STUDENT_ID };
const ok = (profileId: string, extra = {}) => ({ profileId, compatibilityScore: 80, summary: 's', strengths: ['x'], potentialConflicts: [], conversationStarters: ['q'], ...extra });

beforeEach(() => resetMatchState());

describe('Gemini failure handling (mocked)', () => {
  const cases: [string, GenerateFn, string][] = [
    ['non-JSON text', async () => 'Sure! Here are your matches', 'invalid_ai_response'],
    ['empty response', async () => '', 'invalid_ai_response'],
    ['JSON wrapped in markdown', async () => '```json\n{"matches":[]}\n```', 'invalid_ai_response'],
    ['wrong shape', async () => JSON.stringify({ results: [] }), 'invalid_ai_response'],
    ['score above 100', async () => JSON.stringify({ matches: [ok('demo-maya', { compatibilityScore: 1000 })] }), 'invalid_ai_response'],
    ['hallucinated id', async () => JSON.stringify({ matches: [ok('demo-nobody')] }), 'invalid_ai_response'],
    ['duplicate id', async () => JSON.stringify({ matches: [ok('demo-maya'), ok('demo-maya')] }), 'invalid_ai_response'],
    ['the requester itself', async () => JSON.stringify({ matches: [ok(DEMO_STUDENT_ID)] }), 'invalid_ai_response'],
    ['a filtered-out profile (smoker)', async () => JSON.stringify({ matches: [ok('demo-cole')] }), 'invalid_ai_response'],
    ['HTTP 429', async () => { throw Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }); }, 'rate_limited'],
    ['HTTP 503 outage', async () => { throw Object.assign(new Error('The model is overloaded'), { status: 503 }); }, 'ai_error'],
    ['network failure', async () => { throw new TypeError('fetch failed'); }, 'ai_error'],
  ];

  it.each(cases)('%s -> labelled baseline fallback with ranked results', async (_name, generate, reason) => {
    const out = await runMatch({ method: 'POST', body, env, deps: { generate } });
    expect(out.status).toBe(200);
    const json = out.json as MatchResponse;
    expect(json.source).toBe('fallback');
    expect(json.fallbackReason).toBe(reason);
    expect(json.model).toBeUndefined();
    expect(json.matches.length).toBeGreaterThan(0);
    expect(json.profiles?.length).toBe(json.matches.length);
    const ids = json.matches.map((m) => m.profileId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(DEMO_STUDENT_ID);
  });

  it('does not leak provider error text to the client', async () => {
    const out = await runMatch({ method: 'POST', body, env, deps: { generate: async () => { throw new Error('secret-key-abc quota project 123'); } } });
    expect(JSON.stringify(out.json)).not.toMatch(/secret-key-abc|project 123/);
  });

  it('a hung model times out and falls back', async () => {
    const out = await runMatch({ method: 'POST', body, env, deps: { generate: () => new Promise<string>(() => {}), timeoutMs: 20 } });
    expect((out.json as MatchResponse).fallbackReason).toBe('timeout');
  });

  it('a partial (valid) response keeps only the returned candidates', async () => {
    const generate: GenerateFn = async () => JSON.stringify({ matches: [ok('demo-ethan', { compatibilityScore: 91 })] });
    const json = (await runMatch({ method: 'POST', body, env, deps: { generate } })).json as MatchResponse;
    expect(json.source).toBe('gemini');
    expect(json.matches.map((m) => m.profileId)).toEqual(['demo-ethan']);
  });

  it('prompt injection: the injected bio is sent only as sanitized data, never in the system instruction', async () => {
    const riley = ADVERSARIAL_TEST_PROFILES[0]!;
    const pool = [DEMO_STUDENT, riley];
    let prompt = '';
    let system = '';
    const generate: GenerateFn = async (args) => {
      prompt = args.prompt;
      system = args.systemInstruction;
      return JSON.stringify({ matches: [ok(riley.id)] });
    };
    const demoRepository = { getProfile: async (id: string) => pool.find((p) => p.id === id) ?? null, listProfiles: async () => pool };
    await runMatch({ method: 'POST', body, env, deps: { generate, demoRepository } });
    const [beforeCandidates, candidates] = prompt.split('<candidate_data');
    expect(beforeCandidates).not.toContain('IGNORE ALL PREVIOUS');
    expect(candidates).toContain('IGNORE ALL PREVIOUS INSTRUCTIONS'); // inside the data block only
    expect(system).not.toContain('IGNORE ALL PREVIOUS');
  });
});
