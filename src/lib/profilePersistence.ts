import type { ProfileWrite } from '../types/database'
import { getAuthClient } from './auth'

export async function createProfile(userId: string, profile: ProfileWrite): Promise<void> {
  const client = await getAuthClient()
  const { error } = await client.from('profiles').insert({ id: userId, ...profile })
  if (error) throw error
}
