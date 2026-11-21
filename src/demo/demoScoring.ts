import { DEMO_STUDENT } from '../data/demoProfiles';
import { baselineMatch } from '../lib/scoring';
import type { Cleanliness, MatchResult, RoommateProfile as ScoringProfile, SleepSchedule } from '../types/profile';
import type { RoommateProfile as DemoCard } from '../types/RoommateProfile';

const sleep: Record<DemoCard['sleepSchedule'], SleepSchedule> = { early: 'early_bird', night: 'night_owl', flexible: 'flexible' };
const clean: Record<DemoCard['cleanliness'], Cleanliness> = { relaxed: 'relaxed', moderate: 'moderate', tidy: 'tidy' };

/** Adapts a signed-out swipe-demo card to the scoring schema. Only fields the card really has are set. */
export function demoCardToScoringProfile(card: DemoCard): ScoringProfile {
  return {
    id: card.id,
    universityId: card.university.toLowerCase(),
    displayName: card.name,
    bio: card.bio,
    budgetMin: card.budgetMin,
    budgetMax: card.budgetMax,
    distanceFromCampusMiles: card.distanceMiles,
    moveInDate: card.moveInDate,
    roommatesWanted: card.roommatesWanted,
    housingStatus: card.housingStatus === 'have_room' ? 'has_room' : 'needs_room',
    verification: card.verified ? 'university_email_verified' : 'unverified',
    cleanliness: clean[card.cleanliness],
    sleepSchedule: sleep[card.sleepSchedule],
  };
}

/** Deterministic baseline score against the fictional demo student. Not Gemini output. */
export function demoMatchFor(card: DemoCard): MatchResult {
  return baselineMatch(DEMO_STUDENT, demoCardToScoringProfile(card));
}
