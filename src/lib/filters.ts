import type { ProfileFilters, RoommateProfile } from '../types/profile.js';

/** Default move-in window applied between requester and candidate. */
export const DEFAULT_MOVE_IN_WINDOW_DAYS = 60;

const DAY_MS = 86_400_000;

function daysBetween(a: string, b: string): number | null {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(ta - tb) / DAY_MS;
}

function rentOf(p: RoommateProfile): number | undefined {
  return p.housingStatus === 'has_room' ? p.monthlyRent : undefined;
}

/**
 * Pairwise affordability. Uses the real asking rent when someone is offering a
 * room; otherwise falls back to budget-range overlap. A candidate's budgetMax is
 * never treated as the rent they charge.
 */
export function budgetsCompatible(requester: RoommateProfile, candidate: RoommateProfile): boolean {
  const candidateRent = rentOf(candidate);
  if (candidateRent !== undefined) return requester.budgetMax >= candidateRent;
  const requesterRent = rentOf(requester);
  if (requesterRent !== undefined) return candidate.budgetMax >= requesterRent;
  return requester.budgetMin <= candidate.budgetMax && candidate.budgetMin <= requester.budgetMax;
}

/** Explicit dealbreakers declared by `holder` that `other` violates. */
function violatesDealbreaker(holder: RoommateProfile, other: RoommateProfile): boolean {
  const d = holder.dealbreakers ?? [];
  if (d.includes('no_smoking') && other.smoking === 'smoker') return true;
  if (d.includes('no_pets') && other.petPreference === 'has_pets') return true;
  if (d.includes('no_frequent_guests') && other.guestFrequency === 'often') return true;
  return false;
}

function roomTypesCompatible(a?: RoommateProfile['roomType'], b?: RoommateProfile['roomType']): boolean {
  if (!a || !b || a === 'either' || b === 'either') return true;
  return a === b;
}

/** Pair-level hard constraints that exist regardless of UI filters. */
export function passesHardConstraints(requester: RoommateProfile, candidate: RoommateProfile): boolean {
  if (candidate.id === requester.id) return false;
  if (candidate.universityId !== requester.universityId) return false;
  // Two students who both already have rooms have nothing to match on.
  if (requester.housingStatus === 'has_room' && candidate.housingStatus === 'has_room') return false;
  if (!budgetsCompatible(requester, candidate)) return false;
  if (!roomTypesCompatible(requester.roomType, candidate.roomType)) return false;
  if (violatesDealbreaker(requester, candidate) || violatesDealbreaker(candidate, requester)) return false;
  return true;
}

/** UI / request filters. Missing candidate data never excludes unless the filter needs it. */
export function passesFilters(
  candidate: RoommateProfile,
  filters: ProfileFilters,
  requester?: RoommateProfile,
): boolean {
  if (filters.universityId && candidate.universityId !== filters.universityId) return false;

  if (filters.maxMonthlyBudget !== undefined) {
    const cost = rentOf(candidate) ?? candidate.budgetMin;
    if (cost > filters.maxMonthlyBudget) return false;
  }

  if (filters.maxDistanceMiles !== undefined && candidate.distanceFromCampusMiles > filters.maxDistanceMiles) {
    return false;
  }

  if (filters.housingStatus && candidate.housingStatus !== filters.housingStatus) return false;

  if (filters.roommatesWanted !== undefined && candidate.roommatesWanted !== filters.roommatesWanted) {
    return false;
  }

  const reference = filters.moveInDate ?? requester?.moveInDate;
  const window = filters.moveInWithinDays ?? (requester ? DEFAULT_MOVE_IN_WINDOW_DAYS : undefined);
  if (reference && window !== undefined) {
    const diff = daysBetween(reference, candidate.moveInDate);
    if (diff !== null && diff > window) return false;
  }

  if (filters.roomType && !roomTypesCompatible(filters.roomType, candidate.roomType)) return false;

  if (filters.verifiedOnly && candidate.verification !== 'university_email_verified') return false;

  // Optional lifestyle filters exclude only candidates who state something different.
  if (filters.cleanliness?.length && candidate.cleanliness && !filters.cleanliness.includes(candidate.cleanliness)) {
    return false;
  }
  if (filters.sleepSchedule?.length && candidate.sleepSchedule && !filters.sleepSchedule.includes(candidate.sleepSchedule)) {
    return false;
  }

  return true;
}

/**
 * Applies hard constraints and filters. Works on any array of profiles
 * (demo data or rows fetched from Supabase). The requester is always excluded.
 * Without a requester, only the UI filters apply.
 */
export function filterCandidates(
  profiles: RoommateProfile[],
  filters: ProfileFilters = {},
  requester?: RoommateProfile,
): RoommateProfile[] {
  return profiles.filter((candidate) => {
    if (requester && !passesHardConstraints(requester, candidate)) return false;
    return passesFilters(candidate, filters, requester);
  });
}
