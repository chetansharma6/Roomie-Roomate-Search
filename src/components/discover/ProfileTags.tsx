import type { RoommateProfile } from '../../types/profile';

const cleanlinessLabels = {
  relaxed: 'Relaxed about tidiness',
  moderate: 'Moderately tidy',
  tidy: 'Keeps shared spaces tidy',
  very_tidy: 'Very tidy',
};

const sleepLabels = {
  early_bird: 'Early riser',
  flexible: 'Flexible sleep schedule',
  night_owl: 'Night owl',
};

const guestLabels = {
  never: 'Doesn’t host guests',
  rarely: 'Rarely hosts guests',
  sometimes: 'Hosts guests sometimes',
  often: 'Hosts guests often',
};

const petLabels = {
  no_pets: 'Prefers a pet-free home',
  pets_ok: 'Pet-friendly',
  has_pets: 'Has pets',
};

export function ProfileTags({ profile, limit }: { profile: RoommateProfile; limit?: number }) {
  const tags = [
    profile.sleepSchedule && sleepLabels[profile.sleepSchedule],
    profile.cleanliness && cleanlinessLabels[profile.cleanliness],
    profile.petPreference && petLabels[profile.petPreference],
    profile.guestFrequency && guestLabels[profile.guestFrequency],
  ].filter((tag): tag is string => Boolean(tag)).slice(0, limit);

  if (tags.length === 0) return null;
  return <ul className="student-tags" aria-label="Roommate preferences">
    {tags.map((tag) => <li key={tag}>{tag}</li>)}
  </ul>;
}
