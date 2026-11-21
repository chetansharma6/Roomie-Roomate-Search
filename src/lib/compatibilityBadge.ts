import type { MatchResult, MatchSource } from '../types/profile.js';

export type BadgeLabel = 'AI Match' | 'Baseline Match' | 'Compatibility Score';

export type CompatibilityBadgeModel =
  | { state: 'ready'; score: number; label: BadgeLabel; kind: 'ai' | 'baseline' | 'demo' }
  | { state: 'loading' }
  | { state: 'unrated' };

export interface BadgeInput {
  /** The profile shown on the card. A match for any other profile is ignored. */
  profileId: string;
  match?: MatchResult;
  /** Source of the batch response that produced `match`. */
  source?: MatchSource;
  loading?: boolean;
  /** Signed-out demo: scores are fictional baseline estimates, never live Gemini output. */
  demo?: boolean;
}

/** Maps real /api/match output to what the card shows. Never invents a score. */
export function compatibilityBadgeModel({ profileId, match, source, loading, demo }: BadgeInput): CompatibilityBadgeModel {
  if (loading) return { state: 'loading' };
  if (!match || match.profileId !== profileId) return { state: 'unrated' };
  const { compatibilityScore } = match;
  if (!Number.isFinite(compatibilityScore) || compatibilityScore < 0 || compatibilityScore > 100) return { state: 'unrated' };
  const score = Math.round(compatibilityScore);
  if (demo) return { state: 'ready', score, label: 'Compatibility Score', kind: 'demo' };
  if (source === 'gemini') return { state: 'ready', score, label: 'AI Match', kind: 'ai' };
  if (source === 'fallback') return { state: 'ready', score, label: 'Baseline Match', kind: 'baseline' };
  return { state: 'unrated' };
}

/** Accessible text for the badge; the component renders exactly this. */
export function compatibilityBadgeText(model: CompatibilityBadgeModel): string {
  if (model.state === 'loading') return 'Calculating roommate match';
  if (model.state === 'unrated') return 'Not rated';
  return `${model.score}% ${model.label}`;
}

type Hsl = readonly [h: number, s: number, l: number];
// Anchors (score → colour): red, amber-yellow, then the site's dark teal-green. Everything between is interpolated.
const STOPS: ReadonlyArray<readonly [number, Hsl]> = [
  [35, [2, 68, 44]],
  [70, [44, 90, 52]],
  [92, [163, 60, 21]],
];

function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const sat = s / 100, light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Smoothly scaled background (red → yellow → dark green) and the higher-contrast text colour for it. */
export function scoreColor(score: number): { background: string; color: string } {
  const x = Math.min(Math.max(score, STOPS[0]![0]), STOPS[STOPS.length - 1]![0]);
  let hsl: Hsl = STOPS[STOPS.length - 1]![1];
  for (let i = 1; i < STOPS.length; i++) {
    const [x0, a] = STOPS[i - 1]!;
    const [x1, b] = STOPS[i]!;
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      hsl = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      break;
    }
  }
  const lum = luminance(hslToRgb(hsl));
  const white = 1.05 / (lum + 0.05);
  const dark = (lum + 0.05) / (0.02 + 0.05);
  return {
    background: `hsl(${hsl[0].toFixed(1)} ${hsl[1].toFixed(1)}% ${hsl[2].toFixed(1)}%)`,
    color: white >= dark ? '#ffffff' : '#192a25',
  };
}
