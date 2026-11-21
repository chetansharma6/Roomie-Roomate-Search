import type { RoommateProfile } from '../types/profile.js'
import { bedtimeForMatching, guestsForMatching } from './lifestyleDetails.js'

const cleanlinessLabels = {
  relaxed: 'Relaxed about tidiness',
  moderate: 'Moderately tidy',
  tidy: 'Keeps shared spaces tidy',
  very_tidy: 'Very tidy',
}

const sleepLabels = {
  early_bird: 'Early riser',
  flexible: 'Flexible sleep schedule',
  night_owl: 'Night owl',
}

const guestLabels = {
  never: 'Doesn’t host guests',
  rarely: 'Rarely hosts guests',
  sometimes: 'Hosts guests sometimes',
  often: 'Hosts guests often',
}

const petLabels = {
  no_pets: 'Prefers a pet-free home',
  pets_ok: 'Pet-friendly',
  has_pets: 'Has pets',
}

const temperatureLabels = {
  cool: 'Likes a cool home',
  moderate: 'Likes a moderate thermostat',
  warm: 'Likes a warm home',
  flexible: 'Flexible on temperature',
}

const bedtimeLabels = {
  before_10: 'In bed before 10 p.m.',
  '10_to_midnight': 'Bedtime between 10 and midnight',
  after_midnight: 'Night owl',
  varies: 'Bedtime varies',
}

const hostingLabels = {
  rarely: guestLabels.rarely,
  monthly: 'Hosts a few times a month',
  weekly: 'Hosts about once a week',
  several_weekly: 'Hosts several times a week',
}

const quizCleanlinessLabels = {
  ...cleanlinessLabels,
  moderate: 'Tidies a few times a week',
  very_tidy: 'Cleans up right away',
}

const quietLabels = {
  quiet: 'Likes a quiet home',
  moderate: 'Quiet for study and sleep',
  lively: 'Fine with everyday noise',
}

const choreLabels = {
  rotate: 'Rotates chores',
  divide: 'Agrees on who does what',
  as_needed: 'Handles chores as needed',
}

type TagPreferences = Pick<RoommateProfile, 'sleepSchedule' | 'cleanliness' | 'petPreference' | 'guestFrequency' | 'noiseTolerance' | 'lifestyleDetails'>

export function getProfileTags(profile: TagPreferences): string[] {
  const lifestyle = profile.lifestyleDetails
  const bedtime = lifestyle && bedtimeForMatching[lifestyle.bedtime] === profile.sleepSchedule
    ? bedtimeLabels[lifestyle.bedtime]
    : profile.sleepSchedule && sleepLabels[profile.sleepSchedule]
  const guests = lifestyle && guestsForMatching[lifestyle.guests] === profile.guestFrequency
    ? hostingLabels[lifestyle.guests]
    : profile.guestFrequency && guestLabels[profile.guestFrequency]

  return [
    bedtime,
    profile.cleanliness && (lifestyle ? quizCleanlinessLabels : cleanlinessLabels)[profile.cleanliness],
    profile.petPreference && petLabels[profile.petPreference],
    guests,
    profile.noiseTolerance && quietLabels[profile.noiseTolerance],
    lifestyle && temperatureLabels[lifestyle.temperature],
    lifestyle && choreLabels[lifestyle.chores],
  ].filter((tag): tag is string => Boolean(tag))
}
