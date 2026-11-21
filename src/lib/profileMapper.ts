import type { RoommateProfile } from '../types/profile.js';

export function parseProfilePhotoUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    return undefined;
  }
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

/**
 * Maps a Supabase `profiles` row (snake_case) to RoommateProfile.
 * Returns null when required fields are missing. Optional values that are
 * missing or not recognised are dropped (treated as "not provided").
 * Unknown columns, including anything like an email address, are never copied.
 */
export function rowToProfile(row: Row): RoommateProfile | null {
  const id = str(row.id);
  const universityId = str(row.university_id) ?? str(row.university);
  const displayName = str(row.display_name);
  const budgetMin = num(row.budget_min);
  const budgetMax = num(row.budget_max);
  const distance = num(row.distance_from_campus_miles) ?? num(row.distance_max_miles);
  const moveInDate = str(row.move_in_date);
  const roommatesWanted = num(row.roommates_wanted);
  const rawStatus = str(row.housing_status);
  const housingStatus = rawStatus === 'have_room' || rawStatus === 'has_room' ? 'has_room' : rawStatus === 'need_room' || rawStatus === 'needs_room' ? 'needs_room' : undefined;

  if (!id || !universityId || !displayName || budgetMin === undefined || budgetMax === undefined || distance === undefined || !moveInDate || roommatesWanted === undefined || !housingStatus) {
    return null;
  }

  const pets = str(row.pet_preference) ?? str(row.pets_preference);
  return {
    id,
    universityId,
    displayName,
    bio: str(row.bio) ?? '',
    budgetMin,
    budgetMax,
    distanceFromCampusMiles: distance,
    moveInDate: moveInDate.slice(0, 10),
    roommatesWanted,
    housingStatus,
    verification: row.verified_university_email === true ? 'university_email_verified' : 'unverified',
    monthlyRent: num(row.monthly_rent),
    roomType: oneOf(row.room_type, ['private', 'shared', 'either']),
    cleanliness: oneOf(row.cleanliness, ['relaxed', 'moderate', 'tidy', 'very_tidy']),
    sleepSchedule: oneOf(row.sleep_schedule, ['early_bird', 'flexible', 'night_owl']),
    noiseTolerance: oneOf(row.noise_tolerance, ['quiet', 'moderate', 'lively']),
    studyEnvironment: oneOf(row.study_environment, ['silent', 'quiet', 'background_noise_ok', 'away_from_home']),
    guestFrequency: oneOf(row.guest_frequency, ['never', 'rarely', 'sometimes', 'often']),
    petPreference: oneOf(pets, ['no_pets', 'pets_ok', 'has_pets']),
    smoking: oneOf(row.smoking, ['smoke_free', 'outside_only', 'smoker']),
    interests: Array.isArray(row.interests) ? row.interests.filter((i): i is string => typeof i === 'string') : undefined,
    dealbreakers: Array.isArray(row.dealbreakers)
      ? row.dealbreakers.filter((d): d is NonNullable<RoommateProfile['dealbreakers']>[number] =>
          d === 'no_smoking' || d === 'no_pets' || d === 'no_frequent_guests',
        )
      : undefined,
    photoUrl: parseProfilePhotoUrl(row.photo_url),
    major: str(row.major),
    academicYear: oneOf(row.academic_year, ['freshman', 'sophomore', 'junior', 'senior', 'graduate']),
  };
}
