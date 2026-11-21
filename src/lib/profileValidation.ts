import { z } from 'zod'
import { parseProfilePhotoUrl } from './profileMapper'
import { DataAccessError } from './dataAccess'

const amount = z.number().int().min(0).max(100_000)
const optionalText = (max: number) => z.string().trim().max(max).nullable().default(null)

/** Complete writable profile input; omitted optional preferences reset to defaults. */
export const profileInputSchema = z.object({
  display_name: z.string().trim().min(1).max(100),
  major: optionalText(120),
  academic_year: z.enum(['freshman', 'sophomore', 'junior', 'senior', 'graduate']).nullable().default(null),
  bio: optionalText(2000),
  photo_url: z.string().trim().max(2048)
    .refine((url) => Boolean(parseProfilePhotoUrl(url)), 'Enter a valid HTTPS photo URL.')
    .nullable().optional(),
  budget_min: amount,
  budget_max: amount,
  distance_from_campus_miles: z.number().min(0).max(1000),
  roommates_wanted: z.number().int().min(1).max(20),
  move_in_date: z.iso.date().nullable().default(null),
  cleanliness: z.enum(['relaxed', 'moderate', 'tidy', 'very_tidy']).nullable().default(null),
  sleep_schedule: z.enum(['early_bird', 'flexible', 'night_owl']).nullable().default(null),
  noise_tolerance: z.enum(['quiet', 'moderate', 'lively']).nullable().default(null),
  pet_preference: z.enum(['no_pets', 'pets_ok', 'has_pets']).nullable().default(null),
  monthly_rent: amount.nullable().default(null),
  room_type: z.enum(['private', 'shared', 'either']).nullable().default(null),
  study_environment: z.enum(['silent', 'quiet', 'background_noise_ok', 'away_from_home']).nullable().default(null),
  guest_frequency: z.enum(['never', 'rarely', 'sometimes', 'often']).nullable().default(null),
  smoking: z.enum(['smoke_free', 'outside_only', 'smoker']).nullable().default(null),
  dealbreakers: z.array(z.enum(['no_smoking', 'no_pets', 'no_frequent_guests'])).max(3).default([]),
  housing_status: z.enum(['have_room', 'need_room']),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  is_active: z.boolean().default(true),
}).strict().refine((profile) => profile.budget_min <= profile.budget_max, {
  message: 'Minimum budget must not exceed maximum budget.', path: ['budget_max'],
})

export type ProfileInput = z.input<typeof profileInputSchema>

export function validateProfileInput(input: ProfileInput) {
  const result = profileInputSchema.safeParse(input)
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'profile'))]
    throw new DataAccessError('validation', `Check the following profile fields: ${fields.join(', ')}.`)
  }
  return result.data
}

export function validateId(value: string): string {
  const result = z.uuid().safeParse(typeof value === 'string' ? value.trim().toLowerCase() : value)
  if (!result.success) throw new DataAccessError('validation', 'A valid record ID is required.')
  return result.data
}
