import { describe, expect, it } from 'vitest'
import { applyMessageToInbox, dayLabel, inboxTimeLabel, mergeMessages, previewText, sortInbox, totalUnread, validateMessageBody } from '../src/lib/messageState'
import type { InboxRow, MessageRow } from '../src/types/database'

const me = 'me'
const msg = (id: string, over: Partial<MessageRow> = {}): MessageRow => ({
  id, conversation_id: 'c1', sender_id: 'peer', body: `body ${id}`, created_at: '2027-01-01T10:00:00Z', read_at: null, ...over,
})
const row = (id: string, over: Partial<InboxRow> = {}): InboxRow => ({
  conversation_id: id, match_id: `m-${id}`, other_user_id: `u-${id}`, matched_at: '2027-01-01T00:00:00Z',
  last_message_at: '2027-01-01T00:00:00Z', last_message_body: null, last_message_sender_id: null, unread_count: 0, ...over,
})

describe('mergeMessages', () => {
  it('sorts chronologically and collapses duplicate events by id', () => {
    const merged = mergeMessages([msg('b', { created_at: '2027-01-01T11:00:00Z' })], [msg('a'), msg('b', { created_at: '2027-01-01T11:00:00Z' })])
    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
  })
  it('lets a later read receipt update an existing message', () => {
    const merged = mergeMessages([msg('a')], [msg('a', { read_at: '2027-01-01T12:00:00Z' })])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.read_at).toBe('2027-01-01T12:00:00Z')
  })
})

describe('inbox state', () => {
  it('sorts by most recent activity', () => {
    const sorted = sortInbox([row('old'), row('new', { last_message_at: '2027-02-01T00:00:00Z' }), row('mid', { last_message_at: '2027-01-15T00:00:00Z' })])
    expect(sorted.map((r) => r.conversation_id)).toEqual(['new', 'mid', 'old'])
  })
  it('moves a conversation to the top, updates preview and counts unread from others only', () => {
    const rows = [row('c1'), row('c2', { last_message_at: '2027-01-02T00:00:00Z' })]
    const seen = new Set<string>()
    const next = applyMessageToInbox(rows, msg('m1', { conversation_id: 'c1', created_at: '2027-01-03T00:00:00Z' }), me, seen)!
    expect(next[0]!).toMatchObject({ conversation_id: 'c1', last_message_body: 'body m1', unread_count: 1 })
    const own = applyMessageToInbox(next, msg('m2', { conversation_id: 'c1', sender_id: me, created_at: '2027-01-04T00:00:00Z' }), me, seen)!
    expect(own[0]!).toMatchObject({ unread_count: 1, last_message_body: 'body m2' })
  })
  it('does not double count a duplicate Realtime event', () => {
    const seen = new Set<string>()
    const event = msg('m1', { conversation_id: 'c1' })
    const once = applyMessageToInbox([row('c1')], event, me, seen)!
    const twice = applyMessageToInbox(once, event, me, seen)!
    expect(twice[0]!.unread_count).toBe(1)
  })
  it('returns null for a conversation not yet loaded so the caller refetches', () => {
    expect(applyMessageToInbox([row('c1')], msg('m1', { conversation_id: 'nope' }), me)).toBeNull()
  })
  it('totals unread counts, including numeric strings from bigint columns', () => {
    expect(totalUnread([row('a', { unread_count: 2 }), row('b', { unread_count: '3' as unknown as number })])).toBe(5)
  })
})

describe('message formatting', () => {
  it('validates length and trims', () => {
    expect(validateMessageBody('  hi  ')).toBe('hi')
    expect(validateMessageBody('   ')).toBeNull()
    expect(validateMessageBody('x'.repeat(2000))).not.toBeNull()
    expect(validateMessageBody('x'.repeat(2001))).toBeNull()
  })
  it('flattens and truncates previews', () => {
    expect(previewText('a\n\n b')).toBe('a b')
    expect(previewText('x'.repeat(100), 10)).toHaveLength(10)
    expect(previewText(null)).toBe('')
  })
  it('labels days', () => {
    const now = new Date(2027, 5, 10, 15)
    expect(dayLabel(new Date(2027, 5, 10, 1).toISOString(), now)).toBe('Today')
    expect(dayLabel(new Date(2027, 5, 9, 23).toISOString(), now)).toBe('Yesterday')
    expect(inboxTimeLabel(new Date(2027, 5, 1).toISOString(), now)).not.toMatch(/Today|Yesterday/)
  })
})
