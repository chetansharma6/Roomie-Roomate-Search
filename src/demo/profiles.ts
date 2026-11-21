import type { DemoLifestyleAnswers } from '../components/onboarding/lifestyleQuestions';
import type { LifestylePriority } from '../lib/lifestyleDetails';
import type { RoommateProfile } from '../types/RoommateProfile';

// Names are matched to the person shown in /demo-portraits/NN.webp (index + 1).
const people = [
  ['Mateo Rivera', 'Psychology'], ['Mina Cho', 'Computer Science'],
  ['Malik Foster', 'Graphic Design'], ['Clara Evans', 'Mechanical Engineering'],
  ['Priya Shah', 'Public Health'], ['Owen Murphy', 'Environmental Science'],
  ['Leila Hassan', 'Finance'], ['Jin Park', 'Information Technology'],
  ['Ivy Lin', 'Nursing'], ['Rafael Ortiz', 'Architecture'],
  ['Nia Johnson', 'Kinesiology'], ['Caleb Ward', 'Biomedical Sciences'],
  ['Lucas Chen', 'Marketing'], ['Harper Scott', 'Data Science'],
  ['Arjun Mehta', 'Film Studies'], ['Zoe Kim', 'Political Science'],
  ['June Nakamura', 'Electrical Engineering'], ['Ethan Carter', 'Art History'],
  ['Simone Brooks', 'Accounting'], ['Samir Ahmed', 'Marine Biology'],
  ['Maya Brooks', 'Economics'], ['Kai Nguyen', 'Sociology'],
  ['Valentina Cruz', 'Chemistry'], ['Cameron Brooks', 'English'],
  ['Andre Wilson', 'Sport Management'], ['Anika Desai', 'Studio Art'],
  ['Hana Ito', 'Criminal Justice'], ['Luca Moretti', 'Nutrition'],
  ['Layla James', 'Physics'], ['Tariq Ali', 'Social Work'],
  ['Avery Thompson', 'Supply Chain Management'], ['Jordan Lee', 'Mathematics'],
  ['Sofia Alvarez', 'Education'], ['Daniel Choi', 'Digital Media'],
  ['Aisha Robinson', 'Psychology'], ['Eli Price', 'Civil Engineering'],
  ['Noah Patel', 'Hospitality Management'], ['Lena Fischer', 'Geography'],
  ['Emi Watanabe', 'Music'], ['Riley Morgan', 'Philosophy'],
  ['Kenji Mori', 'Health Sciences'], ['Zainab Karim', 'Entrepreneurship'],
  ['Theo Campbell', 'Anthropology'], ['Gabriela Torres', 'Statistics'],
  ['Miles Cooper', 'Theatre'], ['Sophie Tran', 'Advertising'],
  ['Marcus Davis', 'Computer Engineering'], ['Skylar Reed', 'Languages'],
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

const quizCleanliness = { relaxed: 'moderate', moderate: 'moderate', tidy: 'tidy' } as const;
const quizBedtime = { early: 'before_10', night: 'after_midnight', flexible: 'varies' } as const;
const quizGuests = { never: 'rarely', rarely: 'rarely', sometimes: 'monthly', often: 'several_weekly' } as const;
const temperatures = ['moderate', 'cool', 'warm', 'flexible'] as const;
const chores = ['rotate', 'divide', 'as_needed'] as const;
const priorityOptions: readonly LifestylePriority[] = ['quiet', 'cleanliness', 'pets', 'chores', 'temperature', 'guests', 'bedtime'];

export type DemoProfile = RoommateProfile & { lifestyleAnswers: DemoLifestyleAnswers };

function item<T>(values: readonly T[], index: number): T {
  return values[index % values.length]!;
}

function dateAfter(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function avatarUrl(index: number): string {
  return `/demo-portraits/${String(index + 1).padStart(2, '0')}.webp`;
}

/**
 * Synthetic, signed-out UI fixtures only. These profiles are invented, never claim
 * verified status, and never write to Supabase. The demo scorer ignores age, likes,
 * dislikes, photos, and academic major.
 */
export const demoProfiles: DemoProfile[] = people.map(([name, major], index) => {
  const id = `demo-student-${String(index + 1).padStart(2, '0')}`;
  const age = 20 + ((index * 7) % 10);
  const academicYear = item(academicYears, index * 3);
  const budgetMin = 450 + ((index * 73) % 901);
  const budgetMax = budgetMin + 250 + ((index * 43) % 451);
  const likes = Array.from({ length: 4 }, (_, offset) => item(interests, (index * 13) + offset * 11));
  const avoid = item(dislikes, index * 5);
  const housingStatus = index % 3 === 0 ? 'have_room' : 'need_room';
  const cleanlinessPreference = item(cleanliness, index * 7);
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
    lifestyleAnswers: {
      temperature: item(temperatures, index),
      cleanliness: quizCleanliness[cleanlinessPreference],
      bedtime: quizBedtime[sleepSchedule],
      guests: quizGuests[guestFrequency],
      quiet: noiseTolerance,
      chores: item(chores, index + Math.floor(index / 4)),
      pets: petPreference,
      priorities: [item(priorityOptions, index), item(priorityOptions, index + 1 + index % 6)],
    },
    cleanliness: cleanlinessPreference,
    sleepSchedule,
    noiseTolerance,
    guestFrequency,
    petPreference,
    smoking: smokingPreference,
    housingStatus,
    verified: false,
  };
});
