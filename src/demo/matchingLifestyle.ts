import type { DemoLifestyleAnswers } from '../components/onboarding/lifestyleQuestions';

/** Display-only answers for the separate Try roommate matching roster. */
export const matchingDemoHabits: Partial<Record<string, DemoLifestyleAnswers>> = {
  'demo-you': {
    temperature: 'moderate', cleanliness: 'tidy', bedtime: 'before_10', guests: 'monthly',
    quiet: 'quiet', chores: 'rotate', pets: 'pets_ok', priorities: ['quiet', 'cleanliness'],
  },
  'demo-maya': {
    temperature: 'cool', cleanliness: 'tidy', bedtime: 'before_10', guests: 'monthly',
    quiet: 'quiet', chores: 'rotate', pets: 'pets_ok', priorities: ['quiet', 'bedtime'],
  },
  'demo-ethan': {
    temperature: 'moderate', cleanliness: 'tidy', bedtime: 'before_10', guests: 'rarely',
    quiet: 'quiet', chores: 'divide', pets: 'pets_ok', priorities: ['cleanliness', 'quiet'],
  },
  'demo-tyler': {
    temperature: 'cool', cleanliness: 'moderate', bedtime: 'after_midnight', guests: 'several_weekly',
    quiet: 'lively', chores: 'as_needed', pets: 'pets_ok', priorities: ['guests', 'bedtime'],
  },
  'demo-cole': {
    temperature: 'warm', cleanliness: 'moderate', bedtime: 'after_midnight', guests: 'weekly',
    quiet: 'moderate', chores: 'divide', pets: 'has_pets', priorities: ['pets', 'chores'],
  },
  'demo-priya': {
    temperature: 'moderate', cleanliness: 'very_tidy', bedtime: 'before_10', guests: 'rarely',
    quiet: 'quiet', chores: 'rotate', pets: 'no_pets', priorities: ['cleanliness', 'pets'],
  },
  'demo-noah': {
    temperature: 'cool', cleanliness: 'very_tidy', bedtime: 'before_10', guests: 'rarely',
    quiet: 'quiet', chores: 'divide', pets: 'no_pets', priorities: ['quiet', 'guests'],
  },
  'demo-sofia': {
    temperature: 'warm', cleanliness: 'moderate', bedtime: '10_to_midnight', guests: 'monthly',
    quiet: 'moderate', chores: 'rotate', pets: 'pets_ok', priorities: ['chores', 'temperature'],
  },
  'demo-diego': {
    temperature: 'flexible', cleanliness: 'moderate', bedtime: 'after_midnight', guests: 'several_weekly',
    quiet: 'lively', chores: 'as_needed', pets: 'pets_ok', priorities: ['guests', 'pets'],
  },
  'demo-hannah': {
    temperature: 'warm', cleanliness: 'tidy', bedtime: 'before_10', guests: 'rarely',
    quiet: 'quiet', chores: 'rotate', pets: 'has_pets', priorities: ['pets', 'cleanliness'],
  },
  'demo-liam': {
    temperature: 'flexible', cleanliness: 'moderate', bedtime: 'varies', guests: 'monthly',
    quiet: 'lively', chores: 'as_needed', pets: 'pets_ok', priorities: ['chores'],
  },
  'demo-aisha': {
    temperature: 'cool', cleanliness: 'tidy', bedtime: 'after_midnight', guests: 'rarely',
    quiet: 'quiet', chores: 'divide', pets: 'pets_ok', priorities: ['quiet', 'chores'],
  },
  'demo-grace': {
    temperature: 'moderate', cleanliness: 'tidy', bedtime: 'before_10', guests: 'weekly',
    quiet: 'moderate', chores: 'rotate', pets: 'no_pets', priorities: ['bedtime', 'pets'],
  },
  'demo-marcus': {
    temperature: 'flexible', cleanliness: 'moderate', bedtime: 'varies', guests: 'monthly',
    quiet: 'moderate', chores: 'divide', pets: 'pets_ok', priorities: ['guests', 'chores'],
  },
};
