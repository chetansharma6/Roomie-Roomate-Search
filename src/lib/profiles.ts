import type { ProfileRow, ProfileWrite } from '../types/database'
import { DataAccessError, databaseError, withDataAccess } from './dataAccess'
import { validateId, validateProfileInput, type ProfileInput } from './profileValidation'

export type { ProfileInput } from './profileValidation'

// Fixed allowlist: private columns added in future migrations are never selected.
export const PROFILE_COLUMNS = 'id,display_name,university,university_id,major,academic_year,bio,photo_url,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,move_in_date,cleanliness,sleep_schedule,noise_tolerance,pet_preference,monthly_rent,room_type,study_environment,guest_frequency,smoking,dealbreakers,housing_status,interests,is_active,verified_university_email,created_at,updated_at'

export async function getMyProfile(): Promise<ProfileRow | null> {
  return withDataAccess(async ({ client, user }) => {
    const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle()
    if (error) throw databaseError(error)
    return data as ProfileRow | null
  })
}

export async function upsertMyProfile(input: ProfileInput): Promise<ProfileRow> {
  const fields: ProfileWrite = validateProfileInput(input)
  return withDataAccess(async ({ client, user }) => {
    const update = () => client.from('profiles').update(fields).eq('id', user.id).select(PROFILE_COLUMNS).maybeSingle()
    // PostgREST upsert would also UPDATE id, which the database correctly denies.
    const existing = await update()
    if (existing.error) throw databaseError(existing.error)
    if (existing.data) return existing.data as ProfileRow

    const created = await client.from('profiles').insert({ ...fields, id: user.id }).select(PROFILE_COLUMNS).single()
    if (!created.error && created.data) return created.data as ProfileRow
    if (created.error?.code === '23505') {
      // A different tab may have created the row after our first UPDATE.
      const retried = await update()
      if (retried.error) throw databaseError(retried.error)
      if (retried.data) return retried.data as ProfileRow
    } else if (created.error) throw databaseError(created.error)
    throw new DataAccessError('database', 'Could not save your profile. Please retry.')
  })
}

/** First 500 active profiles visible through RLS, excluding the caller. */
export async function listProfiles(): Promise<ProfileRow[]> {
  return withDataAccess(async ({ client, user }) => {
    const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS)
      .eq('is_active', true).neq('id', user.id).order('id').limit(500)
    if (error) throw databaseError(error)
    return (data ?? []) as ProfileRow[]
  })
}

/** Missing and RLS-hidden profiles both return null; no ownership is inferred. */
export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const profileId = validateId(id)
  return withDataAccess(async ({ client }) => {
    const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', profileId).maybeSingle()
    if (error) throw databaseError(error)
    return data as ProfileRow | null
  })
}
