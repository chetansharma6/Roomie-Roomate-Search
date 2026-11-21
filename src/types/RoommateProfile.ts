export interface RoommateProfile {
  id: string;
  name: string;
  university: string;
  major: string;
  bio: string;
  budgetMin: number;
  budgetMax: number;
  distanceMiles: number;
  moveInDate: string;
  roommatesWanted: number;
  cleanliness: 'relaxed' | 'moderate' | 'tidy';
  sleepSchedule: 'early' | 'night' | 'flexible';
  housingStatus: 'have_room' | 'need_room';
  verified: boolean;
}
