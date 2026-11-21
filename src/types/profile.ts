/**
 * Shared roommate profile contract (Person 3 <-> Person 2 database).
 *
 * Required fields are the minimum needed for hard housing filters.
 * Lifestyle preferences are optional: missing values are skipped in scoring
 * rather than penalised.
 *
 * Fairness: nothing here is a protected characteristic. `major` and
 * `academicYear` are display-only and are never used for filtering, scoring,
 * or sent to Gemini.
 */

export type HousingStatus = 'has_room' | 'needs_room';
export type RoomType = 'private' | 'shared' | 'either';
export type Cleanliness = 'relaxed' | 'moderate' | 'tidy' | 'very_tidy';
export type SleepSchedule = 'early_bird' | 'flexible' | 'night_owl';
export type NoiseTolerance = 'quiet' | 'moderate' | 'lively';
export type StudyEnvironment = 'silent' | 'quiet' | 'background_noise_ok' | 'away_from_home';
export type GuestFrequency = 'never' | 'rarely' | 'sometimes' | 'often';
/** no_pets: wants a pet-free home; pets_ok: fine either way; has_pets: owns/brings a pet. */
export type PetPreference = 'no_pets' | 'pets_ok' | 'has_pets';
/** smoke_free: wants smoke-free home; outside_only: tolerates outdoor smoking; smoker: smokes. */
export type SmokingPreference = 'smoke_free' | 'outside_only' | 'smoker';
export type AcademicYear = 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate';
export type VerificationStatus = 'unverified' | 'university_email_verified';
/** Explicit, user-declared hard constraints (applied mutually). */
export type Dealbreaker = 'no_smoking' | 'no_pets' | 'no_frequent_guests';

export interface RoommateProfile {
  // --- required ---
  id: string;
  universityId: string;
  displayName: string;
  bio: string;
  /** Monthly USD the student is willing to pay (range). */
  budgetMin: number;
  budgetMax: number;
  distanceFromCampusMiles: number;
  /** ISO date (YYYY-MM-DD). */
  moveInDate: string;
  /** How many roommates (other than the student) they want in the home. */
  roommatesWanted: number;
  housingStatus: HousingStatus;
  verification: VerificationStatus;

  // --- optional ---
  /** Actual monthly rent per person for the room being offered (has_room only). */
  monthlyRent?: number;
  roomType?: RoomType;
  cleanliness?: Cleanliness;
  sleepSchedule?: SleepSchedule;
  noiseTolerance?: NoiseTolerance;
  studyEnvironment?: StudyEnvironment;
  guestFrequency?: GuestFrequency;
  petPreference?: PetPreference;
  smoking?: SmokingPreference;
  interests?: string[];
  dealbreakers?: Dealbreaker[];

  // --- display-only (never scored, never sent to Gemini) ---
  photoUrl?: string;
  major?: string;
  academicYear?: AcademicYear;
}

/** Hard constraints chosen in the UI / request. All optional; combined with AND. */
export interface ProfileFilters {
  universityId?: string;
  /** "I can pay up to this per month." */
  maxMonthlyBudget?: number;
  maxDistanceMiles?: number;
  housingStatus?: HousingStatus;
  roommatesWanted?: number;
  /** Candidate move-in must be within this many days of the reference date. */
  moveInWithinDays?: number;
  /** Reference move-in date; defaults to the requesting student's. */
  moveInDate?: string;
  roomType?: Exclude<RoomType, 'either'>;
  verifiedOnly?: boolean;
  cleanliness?: Cleanliness[];
  sleepSchedule?: SleepSchedule[];
}

export type MatchSource = 'gemini' | 'fallback';

export interface MatchResult {
  profileId: string;
  /** Estimate (0-100), not a prediction of roommate success. */
  compatibilityScore: number;
  summary: string;
  strengths: string[];
  potentialConflicts: string[];
  conversationStarters: string[];
}

export type FallbackReason =
  | 'no_api_key'
  | 'rate_limited'
  | 'unavailable'
  | 'timeout'
  | 'invalid_ai_response'
  | 'ai_error'
  | 'network_error'
  | 'server_error';

export interface MatchResponse {
  source: MatchSource;
  /** Present when source === 'fallback'. */
  fallbackReason?: FallbackReason;
  model?: string;
  matches: MatchResult[];
  disclaimer: string;
  /**
   * Public candidate cards for the returned matches, supplied by the server so a
   * signed-in browser never needs direct access to the profiles table. Contains
   * only RoommateProfile fields (no email or other private columns).
   */
  profiles?: RoommateProfile[];
}

export const SCORE_DISCLAIMER =
  'Compatibility scores are estimates to start a conversation, not predictions of roommate success.';
