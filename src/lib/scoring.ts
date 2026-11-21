import type { MatchResult, RoommateProfile } from '../types/profile.js';

/** Adjust freely: weights are normalised over the dimensions both profiles filled in. */
export const DEFAULT_WEIGHTS = {
  cleanliness: 0.2,
  sleep: 0.18,
  noise: 0.14,
  study: 0.09,
  guests: 0.1,
  pets: 0.08,
  smoking: 0.06,
  interests: 0.08,
  household: 0.07,
} as const;

export type Dimension = keyof typeof DEFAULT_WEIGHTS;
export type Weights = Record<Dimension, number>;

/**
 * A weighted average lets many small agreements hide one deal-level clash
 * (smoker vs smoke-free, pet-free vs pet owner scored 92-94). Serious clashes
 * therefore cap the overall score, so they can never be labelled a strong match.
 */
export const CONFLICT_CAPS = {
  /** pets / smoking dimension scored 0 (direct clash). */
  direct: 50,
  /** a core day-to-day dimension (cleanliness, sleep, noise, guests) scored below CORE_CLASH. */
  core: 70,
} as const;
const CORE_CLASH = 0.3;
/** Fraction of total weight that must have data on both sides before a score is taken at face value. */
const MIN_CONFIDENT_COVERAGE = 0.5;
const CORE_DIMENSIONS: readonly Dimension[] = ['cleanliness', 'sleep', 'noise', 'guests'];

export interface DimensionScore {
  key: Dimension;
  label: string;
  weight: number;
  /** 0-1, or null when either profile did not provide the data (skipped). */
  score: number | null;
  detail: string;
}

export interface ScoreBreakdown {
  /** Normalised 0-100 lifestyle compatibility (hard housing constraints are separate). */
  score: number;
  dimensions: DimensionScore[];
}

const LABELS: Record<Dimension, string> = {
  cleanliness: 'Cleanliness',
  sleep: 'Sleep schedule',
  noise: 'Noise tolerance',
  study: 'Study habits',
  guests: 'Guests',
  pets: 'Pets',
  smoking: 'Smoking',
  interests: 'Shared interests',
  household: 'Household setup',
};

/** Ordinal similarity: 1 when equal, falling off faster for larger gaps (never perfectly linear). */
function ordinal<T extends string>(scale: readonly T[], a?: T, b?: T): number | null {
  if (!a || !b) return null;
  const ia = scale.indexOf(a);
  const ib = scale.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  const max = scale.length - 1;
  return 1 - (Math.abs(ia - ib) / max) ** 1.5;
}

const CLEAN = ['relaxed', 'moderate', 'tidy', 'very_tidy'] as const;
const SLEEP = ['early_bird', 'flexible', 'night_owl'] as const;
const NOISE = ['quiet', 'moderate', 'lively'] as const;
const GUESTS = ['never', 'rarely', 'sometimes', 'often'] as const;
const STUDY_HOME = ['silent', 'quiet', 'background_noise_ok'] as const;

function study(a: RoommateProfile, b: RoommateProfile): number | null {
  if (!a.studyEnvironment || !b.studyEnvironment) return null;
  // Someone who studies elsewhere is rarely affected by the other person's habits.
  if (a.studyEnvironment === 'away_from_home' || b.studyEnvironment === 'away_from_home') return 0.9;
  return ordinal(STUDY_HOME, a.studyEnvironment, b.studyEnvironment);
}

function pets(a: RoommateProfile, b: RoommateProfile): number | null {
  const pa = a.petPreference;
  const pb = b.petPreference;
  if (!pa || !pb) return null;
  if ((pa === 'no_pets' && pb === 'has_pets') || (pa === 'has_pets' && pb === 'no_pets')) return 0;
  return 1;
}

function smoking(a: RoommateProfile, b: RoommateProfile): number | null {
  const sa = a.smoking;
  const sb = b.smoking;
  if (!sa || !sb) return null;
  if ((sa === 'smoke_free' && sb === 'smoker') || (sa === 'smoker' && sb === 'smoke_free')) return 0;
  if (sa === 'outside_only' && sb === 'smoker') return 0.7;
  if (sa === 'smoker' && sb === 'outside_only') return 0.7;
  return 1;
}

function interests(a: RoommateProfile, b: RoommateProfile): { score: number | null; shared: string[] } {
  if (!a.interests?.length || !b.interests?.length) return { score: null, shared: [] };
  const setB = new Set(b.interests.map((i) => i.trim().toLowerCase()));
  const shared = a.interests.filter((i) => setB.has(i.trim().toLowerCase()));
  // No overlap is neutral-ish, not a conflict.
  return { score: 0.4 + 0.6 * Math.min(1, shared.length / 3), shared };
}

function household(a: RoommateProfile, b: RoommateProfile): number {
  const diff = Math.abs(a.roommatesWanted - b.roommatesWanted);
  const count = diff === 0 ? 1 : diff === 1 ? 0.65 : 0.2;
  const typeMismatch =
    a.roomType && b.roomType && a.roomType !== 'either' && b.roomType !== 'either' && a.roomType !== b.roomType;
  return typeMismatch ? count * 0.5 : count;
}

const DETAIL: Record<Dimension, (s: number) => string> = {
  cleanliness: (s) => (s >= 0.8 ? 'Similar cleanliness expectations' : s >= 0.45 ? 'Somewhat different cleanliness standards' : 'Very different cleanliness standards'),
  sleep: (s) => (s >= 0.8 ? 'Compatible sleep schedules' : s >= 0.45 ? 'Sleep schedules differ a bit' : 'Opposite sleep schedules'),
  noise: (s) => (s >= 0.8 ? 'Similar noise comfort' : s >= 0.45 ? 'Noise comfort differs somewhat' : 'Very different noise comfort'),
  study: (s) => (s >= 0.8 ? 'Study habits fit together' : s >= 0.45 ? 'Study environments differ somewhat' : 'Study environments may clash'),
  guests: (s) => (s >= 0.8 ? 'Similar expectations about guests' : s >= 0.45 ? 'Different comfort with guests' : 'Very different guest expectations'),
  pets: (s) => (s >= 0.8 ? 'No pet conflict' : 'One wants a pet-free home; the other has pets'),
  smoking: (s) => (s >= 0.9 ? 'No smoking conflict' : s >= 0.5 ? 'Smoking expectations need discussion' : 'Smoking preferences conflict'),
  interests: (s) => (s >= 0.7 ? 'Several shared interests' : 'Few shared interests'),
  household: (s) => (s >= 0.8 ? 'Same household size and room setup' : 'Different household size or room type'),
};

export function scoreCompatibility(
  a: RoommateProfile,
  b: RoommateProfile,
  weights: Weights = DEFAULT_WEIGHTS,
): ScoreBreakdown & { sharedInterests: string[] } {
  const interestResult = interests(a, b);
  const raw: Record<Dimension, number | null> = {
    cleanliness: ordinal(CLEAN, a.cleanliness, b.cleanliness),
    sleep: ordinal(SLEEP, a.sleepSchedule, b.sleepSchedule),
    noise: ordinal(NOISE, a.noiseTolerance, b.noiseTolerance),
    study: study(a, b),
    guests: ordinal(GUESTS, a.guestFrequency, b.guestFrequency),
    pets: pets(a, b),
    smoking: smoking(a, b),
    interests: interestResult.score,
    household: household(a, b),
  };

  const dimensions: DimensionScore[] = (Object.keys(weights) as Dimension[]).map((key) => {
    const score = raw[key];
    const detail =
      score === null
        ? 'Not enough information'
        : key === 'interests' && interestResult.shared.length
          ? `Shared: ${interestResult.shared.join(', ')}`
          : DETAIL[key](score);
    return { key, label: LABELS[key], weight: weights[key], score, detail };
  });

  const used = dimensions.filter((d) => d.score !== null && d.weight > 0);
  const totalWeight = used.reduce((sum, d) => sum + d.weight, 0);
  // With no usable data, return a neutral midpoint rather than implying a match or a clash.
  const rawAverage =
    totalWeight === 0 ? 50 : Math.round((100 * used.reduce((sum, d) => sum + d.weight * (d.score as number), 0)) / totalWeight);
  // Little shared data is weak evidence: pull toward neutral (50) until at least half the weight is covered.
  const coverage = Math.min(1, totalWeight / MIN_CONFIDENT_COVERAGE);
  const average = totalWeight === 0 ? 50 : Math.round(50 + (rawAverage - 50) * coverage);
  const directClash = used.some((d) => (d.key === 'pets' || d.key === 'smoking') && d.score === 0);
  const coreClash = used.some((d) => CORE_DIMENSIONS.includes(d.key) && (d.score as number) < CORE_CLASH);
  const score = directClash
    ? Math.min(average, CONFLICT_CAPS.direct)
    : coreClash
      ? Math.min(average, CONFLICT_CAPS.core)
      : average;

  return { score, dimensions, sharedInterests: interestResult.shared };
}

const STARTERS: Partial<Record<Dimension, string>> = {
  cleanliness: 'How often should common areas be cleaned, and how should we split chores?',
  sleep: 'What are your usual sleep and wake times, and how should we handle noise at night?',
  noise: 'How loud is too loud at home, and are there quiet hours we should agree on?',
  study: 'Where and when do you usually study, and what noise level works for you?',
  guests: 'How often do you like having friends over, and are overnight guests okay?',
  pets: 'How do you feel about pets in the home, and who would handle pet care and allergies?',
  smoking: 'What are your expectations about smoking or vaping on the property?',
  household: 'How many people do you want in the home, and what room setup do you each need?',
};

/**
 * Deterministic, non-AI explanation. Used when Gemini is unavailable.
 * The UI must label these as baseline results, not AI-generated analysis.
 */
export function baselineMatch(
  requester: RoommateProfile,
  candidate: RoommateProfile,
  weights: Weights = DEFAULT_WEIGHTS,
): MatchResult {
  const { score, dimensions, sharedInterests } = scoreCompatibility(requester, candidate, weights);
  const scored = dimensions.filter((d) => d.score !== null);
  const strengths = scored
    .filter((d) => (d.score as number) >= 0.8)
    .sort((x, y) => y.weight * (y.score as number) - x.weight * (x.score as number))
    .slice(0, 3)
    .map((d) => d.detail);
  const concerns = scored
    .filter((d) => (d.score as number) < 0.6)
    .sort((x, y) => (x.score as number) - (y.score as number));
  const starters = concerns
    .map((d) => STARTERS[d.key])
    .filter((s): s is string => Boolean(s))
    .slice(0, 3);
  for (const fallback of [STARTERS.cleanliness, STARTERS.guests, STARTERS.sleep]) {
    if (starters.length >= 2) break;
    if (fallback && !starters.includes(fallback)) starters.push(fallback);
  }

  const summary =
    score >= 75
      ? 'Your stated lifestyle preferences line up well on most everyday habits.'
      : score >= 55
        ? 'Your preferences overlap in some areas and differ in others; worth a conversation.'
        : 'Your stated preferences differ on several everyday habits.';

  return {
    profileId: candidate.id,
    compatibilityScore: score,
    summary: sharedInterests.length ? `${summary} Shared interests: ${sharedInterests.join(', ')}.` : summary,
    strengths: strengths.length ? strengths : ['No strong overlaps identified from the available information'],
    potentialConflicts: concerns.slice(0, 4).map((d) => d.detail),
    conversationStarters: starters,
  };
}

/** Ranked baseline matches, best first. Stable for equal scores (keeps input order). */
export function rankBaseline(
  requester: RoommateProfile,
  candidates: RoommateProfile[],
  weights: Weights = DEFAULT_WEIGHTS,
): MatchResult[] {
  return candidates
    .map((c, i) => ({ m: baselineMatch(requester, c, weights), i }))
    .sort((x, y) => y.m.compatibilityScore - x.m.compatibilityScore || x.i - y.i)
    .map(({ m }) => m);
}
