import { describe, expect, it } from 'vitest';
import { compatibilityBadgeModel, compatibilityBadgeText, scoreColor } from '../src/lib/compatibilityBadge';
import { demoMatchFor, demoCardToScoringProfile } from '../src/demo/demoScoring';
import { demoProfiles } from '../src/demo/profiles';
import { baselineMatch } from '../src/lib/scoring';
import { DEMO_STUDENT } from '../src/data/demoProfiles';
import type { MatchResult } from '../src/types/profile';

const match = (profileId: string, compatibilityScore: number): MatchResult => ({
  profileId, compatibilityScore, summary: '', strengths: [], potentialConflicts: [], conversationStarters: [],
});
const html = (input: Parameters<typeof compatibilityBadgeModel>[0]) =>
  compatibilityBadgeText(compatibilityBadgeModel(input));

describe('compatibility badge model', () => {
  it('labels a validated Gemini score "AI Match"', () => {
    expect(compatibilityBadgeModel({ profileId: 'a', match: match('a', 94), source: 'gemini' }))
      .toEqual({ state: 'ready', score: 94, label: 'AI Match', kind: 'ai' });
    expect(html({ profileId: 'a', match: match('a', 94), source: 'gemini' })).toContain('94%');
  });

  it('labels fallback scores "Baseline Match"', () => {
    expect(compatibilityBadgeModel({ profileId: 'a', match: match('a', 71.4), source: 'fallback' }))
      .toEqual({ state: 'ready', score: 71, label: 'Baseline Match', kind: 'baseline' });
    expect(html({ profileId: 'a', match: match('a', 71), source: 'fallback' })).toContain('Baseline Match');
  });

  it('shows a loading state and never a score while loading', () => {
    const out = html({ profileId: 'a', match: match('a', 90), source: 'gemini', loading: true });
    expect(out).toBe('Calculating roommate match');
    expect(out).not.toContain('90%');
  });

  it('shows "Not rated" for missing, invalid or unknown-source scores', () => {
    for (const input of [
      { profileId: 'a' },
      { profileId: 'a', match: match('a', Number.NaN), source: 'gemini' as const },
      { profileId: 'a', match: match('a', 140), source: 'gemini' as const },
      { profileId: 'a', match: match('a', -1), source: 'fallback' as const },
      { profileId: 'a', match: match('a', 80) },
    ]) expect(compatibilityBadgeModel(input)).toEqual({ state: 'unrated' });
    expect(html({ profileId: 'a' })).toContain('Not rated');
  });

  it('never shows a score that belongs to a different profile', () => {
    expect(compatibilityBadgeModel({ profileId: 'b', match: match('a', 94), source: 'gemini' })).toEqual({ state: 'unrated' });
  });

  it('keeps scores attached to the right profile when switching cards', () => {
    const matches = new Map([match('a', 91), match('b', 62)].map((m) => [m.profileId, m]));
    const shown = ['a', 'b', 'a'].map((id) => html({ profileId: id, match: matches.get(id), source: 'gemini' }));
    expect(shown[0]).toContain('91%');
    expect(shown[1]).toContain('62%');
    expect(shown[2]).toContain('91%');
  });

  it('demo scores are labelled as estimates, never as AI', () => {
    const model = compatibilityBadgeModel({ profileId: 'a', match: match('a', 80), source: 'gemini', demo: true });
    expect(model).toMatchObject({ label: 'Compatibility Score', kind: 'demo' });
    expect(html({ profileId: 'a', match: match('a', 80), demo: true })).not.toContain('AI Match');
  });
});

describe('signed-out demo scoring', () => {
  it('reuses the existing baseline scorer against the fictional demo student', () => {
    const card = demoProfiles[0]!;
    expect(demoMatchFor(card)).toEqual(baselineMatch(DEMO_STUDENT, demoCardToScoringProfile(card)));
    expect(demoProfiles.length).toBeGreaterThan(0);
  });

  it('gives every demo card a valid score keyed to its own id', () => {
    for (const card of demoProfiles) {
      const m = demoMatchFor(card);
      expect(m.profileId).toBe(card.id);
      expect(compatibilityBadgeModel({ profileId: card.id, match: m, demo: true }).state).toBe('ready');
    }
  });

  it('differs from authenticated results: same score renders AI vs demo labels', () => {
    const m = match('x', 77);
    expect(html({ profileId: 'x', match: m, source: 'gemini' })).toContain('AI Match');
    expect(html({ profileId: 'x', match: m, demo: true })).toContain('Compatibility Score');
  });
});

describe('score colour scale', () => {
  const hue = (score: number) => Number(/hsl\(([\d.]+)/.exec(scoreColor(score).background)![1]);
  it('runs red → yellow → green as the score rises', () => {
    expect(hue(20)).toBeLessThan(10);
    expect(hue(70)).toBeGreaterThan(35);
    expect(hue(70)).toBeLessThan(55);
    expect(hue(95)).toBeGreaterThan(150);
  });
  it('changes gradually, with no hard cut-offs', () => {
    for (let s = 36; s <= 92; s++) expect(Math.abs(hue(s + 1) - hue(s))).toBeLessThan(6);
    expect(scoreColor(89).background).not.toBe(scoreColor(90).background);
    expect(scoreColor(69).background).not.toBe(scoreColor(70).background);
  });
  it('clamps outside the anchors and keeps text readable', () => {
    expect(scoreColor(0).background).toBe(scoreColor(35).background);
    expect(scoreColor(100).background).toBe(scoreColor(92).background);
    expect(scoreColor(95).color).toBe('#ffffff');
    expect(scoreColor(70).color).toBe('#192a25');
  });
});
