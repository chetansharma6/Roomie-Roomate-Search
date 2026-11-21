import type { InboxRow, InterestResult, MessageRow } from '../types/database'
import { DataAccessError, databaseError, withDataAccess } from './dataAccess'
import { validateMessageBody } from './messageState'
import { validateId } from './profileValidation'

const MESSAGE_COLUMNS = 'id,conversation_id,sender_id,body,created_at,read_at'
const PAGE = 200

/** Records interest through the atomic database function; identity comes from the session. */
export async function expressInterest(targetId: string): Promise<InterestResult> {
  const target = validateId(targetId)
  return withDataAccess(async ({ client, user }) => {
    if (target === user.id.toLowerCase()) throw new DataAccessError('validation', 'You cannot send a roommate request to yourself.')
    const { data, error } = await client.rpc('express_interest', { target_id: target })
    if (error) throw databaseError(error)
    if (!data) throw new DataAccessError('database', 'Could not record your interest. Please retry.')
    return data as unknown as InterestResult
  })
}

export async function getInbox(): Promise<InboxRow[]> {
  return withDataAccess(async ({ client }) => {
    const { data, error } = await client.rpc('get_inbox')
    if (error) throw databaseError(error)
    return ((data ?? []) as InboxRow[]).map((row) => ({ ...row, unread_count: Number(row.unread_count) }))
  })
}

export async function getUnreadCount(): Promise<number> {
  return withDataAccess(async ({ client, user }) => {
    const { count, error } = await client.from('messages').select('id', { count: 'exact', head: true })
      .is('read_at', null).neq('sender_id', user.id)
    if (error) throw databaseError(error)
    return count ?? 0
  })
}

/** Newest PAGE messages, oldest first. Non-participants get an empty list from RLS. */
export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const id = validateId(conversationId)
  return withDataAccess(async ({ client }) => {
    const { data, error } = await client.from('messages').select(MESSAGE_COLUMNS)
      .eq('conversation_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE)
    if (error) throw databaseError(error)
    return ((data ?? []) as MessageRow[]).reverse()
  })
}

/** sender_id is not sent; the database defaults it to auth.uid() and RLS enforces it. */
export async function sendMessage(conversationId: string, body: string): Promise<MessageRow> {
  const id = validateId(conversationId)
  const text = validateMessageBody(body)
  if (!text) throw new DataAccessError('validation', 'Messages must be between 1 and 2000 characters.')
  return withDataAccess(async ({ client }) => {
    const { data, error } = await client.from('messages').insert({ conversation_id: id, body: text })
      .select(MESSAGE_COLUMNS).single()
    if (error) throw databaseError(error)
    if (!data) throw new DataAccessError('database', 'Could not send your message. Please retry.')
    return data as MessageRow
  })
}

/** Marks the other student's unread messages read. The database stamps read_at. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const id = validateId(conversationId)
  return withDataAccess(async ({ client, user }) => {
    const { error } = await client.from('messages').update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id).is('read_at', null).neq('sender_id', user.id)
    if (error) throw databaseError(error)
  })
}

export interface MessageSubscription {
  /** Called for each inserted/updated message visible to the user (RLS-filtered by Supabase Realtime). */
  onMessage: (message: MessageRow, event: 'INSERT' | 'UPDATE') => void
  /** Called after a reconnect so callers can refetch anything missed. */
  onResync: () => void
  onStatus?: (connected: boolean) => void
}

/** Subscribes to message changes. Returns a cleanup function that removes the channel. */
export async function subscribeToMessages(handlers: MessageSubscription): Promise<() => void> {
  const { getAuthClient } = await import('./auth')
  const client = await getAuthClient()
  const channel = client.channel(`messages-${crypto.randomUUID()}`)
  let everConnected = false
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
    const row = payload.new as Partial<MessageRow> | undefined
    if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return
    if (row?.id && row.conversation_id && row.sender_id && typeof row.body === 'string' && row.created_at) {
      handlers.onMessage({ ...row, read_at: row.read_at ?? null } as MessageRow, payload.eventType)
    }
  }).subscribe((status) => {
    const connected = status === 'SUBSCRIBED'
    handlers.onStatus?.(connected)
    if (connected) {
      if (everConnected) handlers.onResync()
      everConnected = true
    }
  })
  return () => { void client.removeChannel(channel) }
}

export interface PeerProfile { id: string; display_name: string; photo_url: string | null; major: string | null }

/** Minimal columns for people the user is matched with. RLS hides deactivated/other-university profiles. */
export async function getPeerProfiles(ids: readonly string[]): Promise<PeerProfile[]> {
  const unique = [...new Set(ids.map(validateId))]
  if (!unique.length) return []
  return withDataAccess(async ({ client }) => {
    let result = await client.from('profiles').select('id,display_name,photo_url,major').in('id', unique)
    if (result.error?.code === '42703') result = await client.from('profiles').select('id,display_name,major').in('id', unique) as typeof result
    if (result.error) throw databaseError(result.error)
    return ((result.data ?? []) as Array<Partial<PeerProfile> & { id: string; display_name: string }>)
      .map((row) => ({ photo_url: null, major: null, ...row }))
  })
}
