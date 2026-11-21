import type { LifestyleDetails } from '../lib/lifestyleDetails';

/** Existing camelCase application contract; keep Person 3's matching types canonical. */
export type { RoommateProfile } from './profile';
import type {
  AcademicYear,
  Cleanliness,
  Dealbreaker,
  GuestFrequency,
  PetPreference,
  RoomType,
  SleepSchedule,
  SmokingPreference,
  StudyEnvironment,
  NoiseTolerance,
} from './profile';

/** Raw public.profiles row. rowToProfile maps completed rows for discovery.
 * Nullable move_in_date means a draft is not yet eligible for that mapper.
 */
export interface ProfileRow {
  id: string;
  display_name: string;
  university: string;
  university_id: string;
  major: string | null;
  academic_year: AcademicYear | null;
  bio: string | null;
  photo_url?: string | null;
  lifestyle_details?: LifestyleDetails | null;
  budget_min: number;
  budget_max: number;
  distance_from_campus_miles: number;
  roommates_wanted: number;
  move_in_date: string | null;
  cleanliness: Cleanliness | null;
  sleep_schedule: SleepSchedule | null;
  noise_tolerance: NoiseTolerance | null;
  pet_preference: PetPreference | null;
  monthly_rent: number | null;
  room_type: RoomType | null;
  study_environment: StudyEnvironment | null;
  guest_frequency: GuestFrequency | null;
  smoking: SmokingPreference | null;
  dealbreakers: Dealbreaker[];
  housing_status: 'have_room' | 'need_room';
  interests: string[];
  is_active: boolean;
  verified_university_email: boolean;
  created_at: string;
  updated_at: string;
}

type OptionalProfileFields = 'major' | 'academic_year' | 'noise_tolerance' | 'room_type' |
  'study_environment' | 'smoking' | 'dealbreakers' | 'interests' | 'lifestyle_details';

export type ProfileWrite = Pick<ProfileRow,
  'display_name' | 'bio' | 'photo_url' | 'budget_min' | 'budget_max' |
  'distance_from_campus_miles' | 'roommates_wanted' | 'move_in_date' | 'cleanliness' |
  'sleep_schedule' | 'pet_preference' | 'monthly_rent' | 'guest_frequency' |
  'housing_status' | 'is_active'
> & Partial<Pick<ProfileRow, OptionalProfileFields>>;

export interface RoommateRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface UniversityDomainRow {
  university_name: string;
  university_id: string;
  domain: string;
  is_active: boolean;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** Result of public.express_interest. matched_now is true only for the call that created the match. */
export interface InterestResult {
  status: RoommateRequestRow['status'];
  request_id: string;
  matched_now: boolean;
  match_id: string | null;
  conversation_id: string | null;
}

/** Row returned by public.get_inbox(). */
export interface InboxRow {
  conversation_id: string;
  match_id: string;
  other_user_id: string;
  matched_at: string;
  last_message_at: string;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
}
