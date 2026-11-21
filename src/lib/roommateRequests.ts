import type { RoommateRequestRow } from '../types/database'
import { DataAccessError, databaseError, withDataAccess } from './dataAccess'
import { validateId } from './profileValidation'

const REQUEST_COLUMNS = 'id,sender_id,receiver_id,status,created_at'
export type RequestResponseStatus = 'accepted' | 'declined'
export interface MyRoommateRequests {
  sent: RoommateRequestRow[]
  received: RoommateRequestRow[]
}

export async function sendRoommateRequest(receiverId: string): Promise<RoommateRequestRow> {
  const receiver = validateId(receiverId)
  return withDataAccess(async ({ client, user }) => {
    if (receiver === user.id.toLowerCase()) throw new DataAccessError('validation', 'You cannot send a roommate request to yourself.')
    // Database default supplies pending; column grants intentionally disallow status on INSERT.
    const { data, error } = await client.from('roommate_requests')
      .insert({ sender_id: user.id, receiver_id: receiver }).select(REQUEST_COLUMNS).single()
    if (error) throw databaseError(error) // The unordered unique index also handles races/reverse duplicates.
    if (!data) throw new DataAccessError('database', 'Could not send the request. Please retry.')
    return data as RoommateRequestRow
  })
}

export async function getMyRoommateRequests(): Promise<MyRoommateRequests> {
  return withDataAccess(async ({ client, user }) => {
    const id = validateId(user.id)
    const rows: RoommateRequestRow[] = []
    // Avoid silently truncating request history at PostgREST's per-query limit.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from('roommate_requests').select(REQUEST_COLUMNS)
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .order('created_at', { ascending: false }).order('id').range(offset, offset + 499)
      if (error) throw databaseError(error)
      const page = (data ?? []) as RoommateRequestRow[]
      rows.push(...page)
      if (page.length < 500) break
    }
    return { sent: rows.filter((row) => row.sender_id === id), received: rows.filter((row) => row.receiver_id === id) }
  })
}

export async function respondToRoommateRequest(requestId: string, status: RequestResponseStatus): Promise<RoommateRequestRow> {
  const id = validateId(requestId)
  if (status !== 'accepted' && status !== 'declined') throw new DataAccessError('validation', 'Choose accepted or declined.')
  return withDataAccess(async ({ client, user }) => {
    const { data, error } = await client.from('roommate_requests').update({ status })
      .eq('id', id).eq('receiver_id', user.id).eq('status', 'pending').select(REQUEST_COLUMNS).maybeSingle()
    if (error) throw databaseError(error)
    if (!data) throw new DataAccessError('not_found', 'This request is unavailable or has already been answered.')
    return data as RoommateRequestRow
  })
}
