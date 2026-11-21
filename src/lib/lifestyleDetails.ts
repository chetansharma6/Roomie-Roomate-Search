import { z } from 'zod'
import type { GuestFrequency, SleepSchedule } from '../types/profile.js'

export const priorityLabels = {
  temperature: 'Temperature at home',
  cleanliness: 'Shared-space cleanliness',
  bedtime: 'Weeknight bedtime',
  guests: 'Having friends over',
  quiet: 'Quiet at home',
  chores: 'Splitting chores',
  pets: 'Pets at home',
} as const

export const lifestyleDetailsSchema = z.object({
  temperature: z.enum(['cool', 'moderate', 'warm', 'flexible']),
  bedtime: z.enum(['before_10', '10_to_midnight', 'after_midnight', 'varies']),
  guests: z.enum(['rarely', 'monthly', 'weekly', 'several_weekly']),
  chores: z.enum(['rotate', 'divide', 'as_needed']),
  priorities: z.array(z.enum(['temperature', 'cleanliness', 'bedtime', 'guests', 'quiet', 'chores', 'pets'])).max(2)
    .refine((priorities) => new Set(priorities).size === priorities.length),
}).strict()

export type LifestyleDetails = z.infer<typeof lifestyleDetailsSchema>
export type LifestylePriority = LifestyleDetails['priorities'][number]

export const bedtimeForMatching: Record<LifestyleDetails['bedtime'], SleepSchedule> = {
  before_10: 'early_bird', '10_to_midnight': 'flexible', after_midnight: 'night_owl', varies: 'flexible',
}

export const guestsForMatching: Record<LifestyleDetails['guests'], GuestFrequency> = {
  rarely: 'rarely', monthly: 'sometimes', weekly: 'sometimes', several_weekly: 'often',
}
