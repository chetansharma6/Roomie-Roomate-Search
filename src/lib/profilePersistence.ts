import type { ProfileWrite } from '../types/database'
import { upsertMyProfile } from './profiles'

/** @deprecated Use upsertMyProfile; the legacy ownership argument is ignored. */
export async function createProfile(_userId: string, profile: ProfileWrite): Promise<void> {
  await upsertMyProfile(profile)
}
