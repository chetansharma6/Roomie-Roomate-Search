import type { RoommateProfile } from '../src/types/profile.js';

export function makeProfile(overrides: Partial<RoommateProfile> = {}): RoommateProfile {
  return {
    id: 'p',
    universityId: 'usf',
    displayName: 'Test',
    bio: 'bio',
    budgetMin: 700,
    budgetMax: 900,
    distanceFromCampusMiles: 2,
    moveInDate: '2027-08-01',
    roommatesWanted: 2,
    housingStatus: 'needs_room',
    verification: 'university_email_verified',
    ...overrides,
  };
}
