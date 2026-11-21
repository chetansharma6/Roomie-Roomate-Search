import { describe, expect, it } from 'vitest';
import { DEMO_PROFILES, DEMO_STUDENT } from '../src/data/demoProfiles.js';
import { filterCandidates } from '../src/lib/filters.js';
import { DEFAULT_WEIGHTS, type Weights, baselineMatch, rankBaseline, scoreCompatibility } from '../src/lib/scoring.js';
import { makeProfile } from './helpers.js';

const base = makeProfile({ cleanliness: 'tidy', sleepSchedule: 'early_bird', noiseTolerance: 'quiet', guestFrequency: 'rarely', interests: ['hiking', 'Gaming'] });

describe('deterministic scoring', () => {
  it('is deterministic and within 0-100', () => {
    const other = makeProfile({ id: 'o', cleanliness: 'relaxed', sleepSchedule: 'night_owl' });
    const a = scoreCompatibility(base, other);
    expect(scoreCompatibility(base, other).score).toBe(a.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });
  it('rates a similar housemate above a clashing one', () => {
    const similar = makeProfile({ id: 's', cleanliness: 'tidy', sleepSchedule: 'early_bird', noiseTolerance: 'quiet', guestFrequency: 'rarely' });
    const clash = makeProfile({ id: 'c', cleanliness: 'relaxed', sleepSchedule: 'night_owl', noiseTolerance: 'lively', guestFrequency: 'often' });
    expect(scoreCompatibility(base, similar).score).toBeGreaterThan(90);
    expect(scoreCompatibility(base, clash).score).toBeLessThan(35);
  });
  it('lets small differences coexist rather than scoring zero', () => {
    const flexible = makeProfile({ id: 'f', sleepSchedule: 'flexible' });
    expect(scoreCompatibility(base, flexible).dimensions.find((d) => d.key === 'sleep')!.score).toBeGreaterThan(0.6);
  });
  it('skips dimensions with missing data and stays neutral with none', () => {
    const sparse = makeProfile({ id: 'x' });
    const bare = makeProfile({ id: 'y' });
    const r = scoreCompatibility(sparse, bare);
    expect(r.dimensions.filter((d) => d.score === null).length).toBeGreaterThan(5);
    expect(Number.isFinite(r.score)).toBe(true);
  });
  it('treats no shared interests as neutral, case-insensitively matches shared ones', () => {
    const shared = scoreCompatibility(base, makeProfile({ id: 'i', interests: ['GAMING'] }));
    expect(shared.sharedInterests).toEqual(['Gaming']);
  });
  it('treats a pet/smoking clash as zero in that dimension', () => {
    const r = scoreCompatibility(makeProfile({ petPreference: 'no_pets', smoking: 'smoke_free' }), makeProfile({ id: 'z', petPreference: 'has_pets', smoking: 'smoker' }));
    expect(r.dimensions.find((d) => d.key === 'pets')!.score).toBe(0);
    expect(r.dimensions.find((d) => d.key === 'smoking')!.score).toBe(0);
  });
  it('honours adjustable weights', () => {
    const o = makeProfile({ id: 'o', cleanliness: 'relaxed', sleepSchedule: 'early_bird' });
    const cleanOnly = { ...Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((k) => [k, 0])) as Weights, cleanliness: 1 } as Weights;
    const sleepOnly = { ...cleanOnly, cleanliness: 0, sleep: 1 } as Weights;
    expect(scoreCompatibility(base, o, cleanOnly).score).toBeLessThan(scoreCompatibility(base, o, sleepOnly).score);
  });
});

describe('baseline explanation and ranking', () => {
  it('produces schema-shaped output with concerns and starters', () => {
    const m = baselineMatch(base, makeProfile({ id: 'c', cleanliness: 'relaxed', guestFrequency: 'often' }));
    expect(m.profileId).toBe('c');
    expect(m.potentialConflicts.length).toBeGreaterThan(0);
    expect(m.conversationStarters.length).toBeGreaterThanOrEqual(2);
    expect(m.strengths.length).toBeLessThanOrEqual(3);
  });
  it('ranks the demo strong match far above the demo conflict match', () => {
    const eligible = filterCandidates(DEMO_PROFILES, {}, DEMO_STUDENT);
    const ranked = rankBaseline(DEMO_STUDENT, eligible);
    const score = (id: string) => ranked.find((m) => m.profileId === id)!.compatibilityScore;
    expect(ranked[0]!.compatibilityScore).toBeGreaterThanOrEqual(ranked.at(-1)!.compatibilityScore);
    expect(score('demo-maya')).toBeGreaterThan(85);
    expect(score('demo-maya') - score('demo-tyler')).toBeGreaterThan(35);
  });
});
