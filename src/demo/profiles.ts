import type { RoommateProfile } from '../types/RoommateProfile';

const people = [
  ['Maya Brooks', 'Psychology'], ['Jordan Lee', 'Computer Science'], ['Amara Davis', 'Graphic Design'],
  ['Ethan Carter', 'Mechanical Engineering'], ['Sofia Alvarez', 'Public Health'], ['Noah Patel', 'Environmental Science'],
  ['Avery Thompson', 'Finance'], ['Kai Nguyen', 'Information Technology'], ['Riley Morgan', 'Nursing'],
  ['Leila Hassan', 'Architecture'], ['Mateo Rivera', 'Kinesiology'], ['Zoe Kim', 'Biomedical Sciences'],
  ['Andre Wilson', 'Marketing'], ['Priya Shah', 'Data Science'], ['Cameron Brooks', 'Film Studies'],
  ['Nia Johnson', 'Political Science'], ['Lucas Chen', 'Electrical Engineering'], ['Elena Garcia', 'Art History'],
  ['Drew Martin', 'Accounting'], ['Aisha Robinson', 'Marine Biology'], ['Owen Murphy', 'Economics'],
  ['Valentina Cruz', 'Sociology'], ['Samir Ahmed', 'Chemistry'], ['Harper Scott', 'English'],
  ['Jules Bennett', 'Sport Management'], ['Ivy Lin', 'Studio Art'], ['Malik Foster', 'Criminal Justice'],
  ['Clara Evans', 'Nutrition'], ['Theo Campbell', 'Physics'], ['Gabriela Torres', 'Social Work'],
  ['Quinn Bailey', 'Supply Chain Management'], ['Jin Park', 'Mathematics'], ['Layla James', 'Education'],
  ['Miles Cooper', 'Digital Media'], ['Anika Desai', 'Psychology'], ['Rafael Ortiz', 'Civil Engineering'],
  ['Skylar Reed', 'Hospitality Management'], ['Tariq Ali', 'Geography'], ['June Nakamura', 'Music'],
  ['Eli Price', 'Philosophy'], ['Mina Cho', 'Health Sciences'], ['Caleb Ward', 'Entrepreneurship'],
  ['Simone Brooks', 'Anthropology'], ['Arjun Mehta', 'Statistics'], ['Sage Turner', 'Theatre'],
  ['Isabel Flores', 'Advertising'], ['Devon Price', 'Computer Engineering'], ['Lena Fischer', 'Languages'],
] as const;

const interests = [
  'thrifting', 'baking sourdough', 'pickup soccer', 'birdwatching', 'indie films', 'K-pop', 'trail running',
  'ceramics', 'board games', 'coffee tasting', 'volunteering', 'kayaking', 'live jazz', 'plant care',
  'photography', 'meal prep', 'anime', 'rock climbing', 'poetry', 'museum trips', 'yoga', 'basketball',
  'video editing', 'farmers markets', 'guitar', 'tabletop RPGs', 'cycling', 'cooking Thai food', 'podcasts',
  'swimming', 'fashion design', 'tennis', 'astronomy', 'sketching', 'salsa dancing', 'coding side projects',
  'beach cleanups', 'crosswords', 'dog walking', 'F1 racing', 'gardening', 'roller skating', 'reading sci-fi',
  'camping', 'making playlists', 'interior design', 'weight training', 'language exchange', 'candle making',
] as const;

const dislikes = [
  ['smoke indoors', 'dirty dishes left overnight'],
  ['surprise guests', 'loud calls after midnight'],
  ['shared food being used without asking', 'strong fragrances'],
  ['a chore schedule that is never followed', 'music through shared walls'],
  ['overnight guests without notice', 'clutter in common areas'],
  ['pets on the furniture', 'thermostat arguments'],
  ['kitchen messes after cooking', 'early-morning noise'],
  ['smoking near the entrance', 'unplanned parties'],
  ['lights left on all night', 'passive-aggressive notes'],
  ['shoes on the sofa', 'last-minute rent surprises'],
  ['a constantly loud TV', 'fridge shelves going unlabeled'],
  ['people borrowing things without asking', 'scented cleaning products'],
] as const;

const academicYears = ['freshman', 'sophomore', 'junior', 'senior', 'graduate'] as const;
const cleanliness = ['relaxed', 'moderate', 'tidy'] as const;
const sleep = ['early', 'night', 'flexible'] as const;
const noise = ['quiet', 'moderate', 'lively'] as const;
const guests = ['never', 'rarely', 'sometimes', 'often'] as const;
const pets = ['no_pets', 'pets_ok', 'has_pets'] as const;
const smoking = ['smoke_free', 'outside_only', 'smoker'] as const;

function item<T>(values: readonly T[], index: number): T {
  return values[index % values.length]!;
}

function dateAfter(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function avatarUrl(index: number): string {
  const sheet = Math.floor(index / 16) + 1;
  const tile = index % 16;
  const column = tile % 4;
  const row = Math.floor(tile / 4);
  return `/demo-portraits/sheet-${sheet}.png#tile=${column},${row}`;
}

/**
 * Synthetic, signed-out UI fixtures only. These profiles are invented, never claim
 * verified status, and never write to Supabase. The demo scorer ignores age, likes,
 * dislikes, photos, and academic major.
 */
export const demoProfiles: RoommateProfile[] = people.map(([name, major], index) => {
  const id = `demo-student-${String(index + 1).padStart(2, '0')}`;
  const age = 20 + ((index * 7) % 10);
  const academicYear = item(academicYears, index * 3);
  const budgetMin = 450 + ((index * 73) % 901);
  const budgetMax = budgetMin + 250 + ((index * 43) % 451);
  const likes = Array.from({ length: 4 }, (_, offset) => item(interests, (index * 13) + offset * 11));
  const avoid = item(dislikes, index * 5);
  const housingStatus = index % 3 === 0 ? 'have_room' : 'need_room';
  const sleepSchedule = item(sleep, index * 2);
  const noiseTolerance = item(noise, index * 5);
  const guestFrequency = item(guests, index * 7);
  const petPreference = item(pets, index * 4);
  const smokingPreference = item(smoking, index * 5);
  const distanceMiles = Number((0.5 + ((index * 19) % 121) / 10).toFixed(1));
  const moveInDate = dateAfter('2027-07-01', (index * 11) % 123);
  const roommatesWanted = 1 + ((index * 3) % 4);
  const housingLine = housingStatus === 'have_room'
    ? 'I have a room available and would like to find a considerate housemate.'
    : 'I am looking for a room and am open to touring places with potential roommates.';

  return {
    id,
    name,
    photoUrl: avatarUrl(index),
    university: 'USF',
    major,
    age,
    interests: likes,
    dislikes: [...avoid],
    bio: `${age}-year-old ${academicYear} student. ${housingLine} I like ${likes.slice(0, 3).join(', ')}. I would rather avoid ${avoid.join(' and ')}.`,
    budgetMin,
    budgetMax,
    distanceMiles,
    moveInDate,
    roommatesWanted,
    cleanliness: item(cleanliness, index * 7),
    sleepSchedule,
    noiseTolerance,
    guestFrequency,
    petPreference,
    smoking: smokingPreference,
    housingStatus,
    verified: false,
  };
});
