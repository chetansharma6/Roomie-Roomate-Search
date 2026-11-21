import type { InboxRow, MessageRow } from '../types/database'

export const MAX_MESSAGE_LENGTH = 2000

/** Merge by id (duplicate Realtime/refetch events collapse), oldest first. */
export function mergeMessages(existing: readonly MessageRow[], incoming: readonly MessageRow[]): MessageRow[] {
  const byId = new Map<string, MessageRow>()
  for (const message of [...existing, ...incoming]) byId.set(message.id, { ...byId.get(message.id), ...message })
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export function sortInbox(rows: readonly InboxRow[]): InboxRow[] {
  return [...rows].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at) || a.conversation_id.localeCompare(b.conversation_id))
}

/** Apply a newly delivered message to inbox state without a refetch. Returns null if the conversation is unknown. */
export function applyMessageToInbox(rows: readonly InboxRow[], message: MessageRow, currentUserId: string, seenIds?: Set<string>): InboxRow[] | null {
  const row = rows.find((candidate) => candidate.conversation_id === message.conversation_id)
  if (!row) return null
  if (seenIds?.has(message.id)) return [...rows]
  seenIds?.add(message.id)
  const newer = message.created_at >= row.last_message_at
  const unread = message.sender_id !== currentUserId && message.read_at === null ? 1 : 0
  return sortInbox(rows.map((candidate) => candidate === row ? {
    ...row,
    last_message_at: newer ? message.created_at : row.last_message_at,
    last_message_body: newer ? message.body : row.last_message_body,
    last_message_sender_id: newer ? message.sender_id : row.last_message_sender_id,
    unread_count: row.unread_count + unread,
  } : candidate))
}

export function validateMessageBody(raw: string): string | null {
  const body = raw.trim()
  return body.length >= 1 && body.length <= MAX_MESSAGE_LENGTH ? body : null
}

export function totalUnread(rows: readonly InboxRow[]): number {
  return rows.reduce((sum, row) => sum + Number(row.unread_count), 0)
}

export function previewText(body: string | null, max = 80): string {
  const flat = (body ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Inbox timestamp: time for today, otherwise a short date. */
export function inboxTimeLabel(iso: string, now = new Date()): string {
  return dayLabel(iso, now) === 'Today' ? timeLabel(iso) : dayLabel(iso, now)
}

export function peerName(peers: ReadonlyMap<string, { display_name: string }>, id: string): string {
  return peers.get(id)?.display_name ?? 'Roommate'
}
