import type { ProfileWrite } from '../types/database'
import { getAuthClient } from './auth'

export async function createProfile(userId: string, profile: ProfileWrite): Promise<void> {
  const client = await getAuthClient()
  const { error } = await client.from('profiles').insert({ id: userId, ...profile })
  if (!error) return
  if (error.code !== '23505') throw error

  // A returning student may have a draft. Only finish incomplete rows.
  const { error: updateError } = await client.from('profiles').update(profile)
    .eq('id', userId).is('move_in_date', null)
  if (updateError) throw updateError
}

export async function sendRoommateInterest(senderId: string, receiverId: string): Promise<void> {
  const client = await getAuthClient()
  const { error } = await client.from('roommate_requests').insert({ sender_id: senderId, receiver_id: receiverId })
  if (error && error.code !== '23505') throw error
}
