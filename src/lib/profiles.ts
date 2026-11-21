import type { ProfileRow, ProfileWrite } from '../types/database'
import { DataAccessError, databaseError, withDataAccess } from './dataAccess'
import { validateId, validateProfileInput, type ProfileInput } from './profileValidation'

export type { ProfileInput } from './profileValidation'

// Fixed allowlist: private columns added in future migrations are never selected.
export const PROFILE_COLUMNS = 'id,display_name,university,university_id,major,academic_year,bio,photo_url,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,move_in_date,cleanliness,sleep_schedule,noise_tolerance,pet_preference,monthly_rent,room_type,study_environment,guest_frequency,smoking,dealbreakers,housing_status,interests,is_active,verified_university_email,created_at,updated_at'
const PROFILE_COLUMNS_WITHOUT_PHOTO = PROFILE_COLUMNS.split(',').filter((column) => column !== 'photo_url').join(',')

type ProfileColumnError = { code?: string; message?: string; details?: string }

function isMissingPhotoColumn(error: ProfileColumnError | null): boolean {
  return error?.code === '42703' && /photo_url/i.test(`${error.message ?? ''} ${error.details ?? ''}`)
}

function withoutPhotoUrl(fields: ProfileWrite): ProfileWrite {
  const rest = { ...fields }
  delete rest.photo_url
  return rest
}

function unavailablePhotoWrite(): DataAccessError {
  return new DataAccessError('validation', 'Profile photo saving is unavailable until the photo_url database migration is applied. Clear the photo URL and retry.')
}

export async function getMyProfile(): Promise<ProfileRow | null> {
  return withDataAccess(async ({ client, user }) => {
    let result = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle()
    if (isMissingPhotoColumn(result.error)) {
      result = await client.from('profiles').select(PROFILE_COLUMNS_WITHOUT_PHOTO).eq('id', user.id).maybeSingle()
    }
    const { data, error } = result
    if (error) throw databaseError(error)
    return data as ProfileRow | null
  })
}

export async function upsertMyProfile(input: ProfileInput): Promise<ProfileRow> {
  const fields: ProfileWrite = validateProfileInput(input)
  return withDataAccess(async ({ client, user }) => {
    const update = (values: ProfileWrite, columns = PROFILE_COLUMNS) => client.from('profiles').update(values).eq('id', user.id).select(columns).maybeSingle()
    // PostgREST upsert would also UPDATE id, which the database correctly denies.
    let legacyPhotoSchema = false
    let existing = await update(fields)
    if (isMissingPhotoColumn(existing.error)) {
      if (fields.photo_url) throw unavailablePhotoWrite()
      legacyPhotoSchema = true
      existing = await update(withoutPhotoUrl(fields), PROFILE_COLUMNS_WITHOUT_PHOTO)
    }
    if (existing.error) throw databaseError(existing.error)
    if (existing.data) return existing.data as unknown as ProfileRow

    const insert = (values: ProfileWrite, columns = PROFILE_COLUMNS) => client.from('profiles').insert({ ...values, id: user.id }).select(columns).single()
    let created = legacyPhotoSchema
      ? await insert(withoutPhotoUrl(fields), PROFILE_COLUMNS_WITHOUT_PHOTO)
      : await insert(fields)
    if (!legacyPhotoSchema && isMissingPhotoColumn(created.error)) {
      if (fields.photo_url) throw unavailablePhotoWrite()
      legacyPhotoSchema = true
      created = await insert(withoutPhotoUrl(fields), PROFILE_COLUMNS_WITHOUT_PHOTO)
    }
    if (!created.error && created.data) return created.data as unknown as ProfileRow
    if (created.error?.code === '23505') {
      // A different tab may have created the row after our first UPDATE.
      const retried = await update(legacyPhotoSchema ? withoutPhotoUrl(fields) : fields, legacyPhotoSchema ? PROFILE_COLUMNS_WITHOUT_PHOTO : PROFILE_COLUMNS)
      if (retried.error) throw databaseError(retried.error)
      if (retried.data) return retried.data as unknown as ProfileRow
    } else if (created.error) throw databaseError(created.error)
    throw new DataAccessError('database', 'Could not save your profile. Please retry.')
  })
}

/** First 500 active profiles visible through RLS, excluding the caller. */
export async function listProfiles(): Promise<ProfileRow[]> {
  return withDataAccess(async ({ client, user }) => {
    const query = (columns: string) => client.from('profiles').select(columns)
      .eq('is_active', true).neq('id', user.id).order('id').limit(500)
    let result = await query(PROFILE_COLUMNS)
    if (isMissingPhotoColumn(result.error)) result = await query(PROFILE_COLUMNS_WITHOUT_PHOTO)
    const { data, error } = result
    if (error) throw databaseError(error)
    return (data ?? []) as unknown as ProfileRow[]
  })
}

/** Missing and RLS-hidden profiles both return null; no ownership is inferred. */
export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const profileId = validateId(id)
  return withDataAccess(async ({ client }) => {
    let result = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', profileId).maybeSingle()
    if (isMissingPhotoColumn(result.error)) {
      result = await client.from('profiles').select(PROFILE_COLUMNS_WITHOUT_PHOTO).eq('id', profileId).maybeSingle()
    }
    const { data, error } = result
    if (error) throw databaseError(error)
    return data as ProfileRow | null
  })
}
