export interface RoommateProfile {
  id: string;
  name: string;
  photoUrl?: string;
  university: string;
  major: string;
  /** Fictional demo-only age; never used to score or filter matches. */
  age: number;
  interests: string[];
  dislikes: string[];
  bio: string;
  budgetMin: number;
  budgetMax: number;
  distanceMiles: number;
  moveInDate: string;
  roommatesWanted: number;
  cleanliness: 'relaxed' | 'moderate' | 'tidy';
  sleepSchedule: 'early' | 'night' | 'flexible';
  noiseTolerance: 'quiet' | 'moderate' | 'lively';
  guestFrequency: 'never' | 'rarely' | 'sometimes' | 'often';
  petPreference: 'no_pets' | 'pets_ok' | 'has_pets';
  smoking: 'smoke_free' | 'outside_only' | 'smoker';
  housingStatus: 'have_room' | 'need_room';
  verified: boolean;
}
