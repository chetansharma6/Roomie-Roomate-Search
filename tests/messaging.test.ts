import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getAuthClient: vi.fn() }))
vi.mock('../src/lib/auth', () => ({
  ...mocks,
  RoomieAuthError: class extends Error { constructor(public code: string, message: string) { super(message) } },
}))
import { expressInterest, getInbox, listMessages, markConversationRead, sendMessage, subscribeToMessages } from '../src/lib/messaging'

const me = '00000000-0000-4000-8000-000000000001'
const peer = '00000000-0000-4000-8000-000000000002'
const conv = '00000000-0000-4000-8000-000000000003'
type Result = { data: unknown; error: { code: string } | null }
let result: Result
let calls: Array<{ method: string; args: unknown[] }>
const rpc = vi.fn()
const client = {
  rpc,
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  result = { data: null, error: null }
  calls = []
  mocks.getCurrentUser.mockResolvedValue({ id: me })
  mocks.getAuthClient.mockResolvedValue(client)
  rpc.mockImplementation(async () => result)
  client.from.mockImplementation(() => {
    const q: Record<string, unknown> = { then: (res: (r: Result) => unknown) => Promise.resolve(result).then(res) }
    for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'is', 'order', 'limit', 'single']) {
      q[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return q }
    }
    return q
  })
})

describe('expressInterest', () => {
  it('sends only the target id; identity comes from the session', async () => {
    result = { data: { status: 'pending', request_id: 'r', matched_now: false, match_id: null, conversation_id: null }, error: null }
    expect(await expressInterest(peer)).toMatchObject({ status: 'pending', matched_now: false })
    expect(rpc).toHaveBeenCalledWith('express_interest', { target_id: peer })
  })
  it('reports a genuine match once', async () => {
    result = { data: { status: 'accepted', request_id: 'r', matched_now: true, match_id: 'm', conversation_id: conv }, error: null }
    expect(await expressInterest(peer)).toMatchObject({ matched_now: true, conversation_id: conv })
  })
  it('rejects self-interest and malformed ids before calling the database', async () => {
    await expect(expressInterest(me)).rejects.toMatchObject({ code: 'validation' })
    await expect(expressInterest('not-a-uuid')).rejects.toMatchObject({ code: 'validation' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('requires a signed-in user (signed-out demo users cannot create matches)', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    await expect(expressInterest(peer)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('maps database denials without leaking details', async () => {
    result = { data: null, error: { code: '42501' } }
    await expect(expressInterest(peer)).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('messages', () => {
  it('never sends sender_id and trims the body', async () => {
    result = { data: { id: 'm', body: 'hi' }, error: null }
    await sendMessage(conv, '  hi  ')
    expect(calls.find((c) => c.method === 'insert')?.args[0]).toEqual({ conversation_id: conv, body: 'hi' })
  })
  it('rejects empty, oversized and non-UUID input before writing', async () => {
    await expect(sendMessage(conv, '   ')).rejects.toMatchObject({ code: 'validation' })
    await expect(sendMessage(conv, 'x'.repeat(2001))).rejects.toMatchObject({ code: 'validation' })
    await expect(sendMessage('bad', 'hi')).rejects.toMatchObject({ code: 'validation' })
    expect(client.from).not.toHaveBeenCalled()
  })
  it('surfaces RLS denial for non-participants as forbidden', async () => {
    result = { data: null, error: { code: '42501' } }
    await expect(sendMessage(conv, 'hi')).rejects.toMatchObject({ code: 'forbidden' })
  })
  it('lists newest page oldest-first and returns empty for hidden conversations', async () => {
    result = { data: [{ id: 'b' }, { id: 'a' }], error: null }
    expect((await listMessages(conv)).map((m) => m.id)).toEqual(['a', 'b'])
    result = { data: [], error: null }
    expect(await listMessages(conv)).toEqual([])
  })
  it('marks only the other student\'s unread messages read', async () => {
    await markConversationRead(conv)
    expect(calls).toContainEqual({ method: 'is', args: ['read_at', null] })
    expect(calls).toContainEqual({ method: 'neq', args: ['sender_id', me] })
  })
  it('coerces bigint unread counts from the inbox function', async () => {
    result = { data: [{ conversation_id: conv, unread_count: '2' }], error: null }
    expect((await getInbox())[0]!.unread_count).toBe(2)
    result = { data: null, error: null }
    expect(await getInbox()).toEqual([])
  })
})

describe('subscribeToMessages', () => {
  function fakeChannel() {
    let change: (payload: unknown) => void = () => undefined
    let status: (s: string) => void = () => undefined
    const channel = {
      on: vi.fn((_t: string, _f: unknown, cb: (p: unknown) => void) => { change = cb; return channel }),
      subscribe: vi.fn((cb: (s: string) => void) => { status = cb; return channel }),
    }
    client.channel.mockReturnValue(channel)
    return { emit: (p: unknown) => change(p), status: (s: string) => status(s) }
  }
  const row = { id: 'm1', conversation_id: conv, sender_id: peer, body: 'hi', created_at: '2027-01-01T00:00:00Z', read_at: null }

  it('forwards valid messages and ignores malformed or delete events', async () => {
    const ch = fakeChannel()
    const onMessage = vi.fn()
    await subscribeToMessages({ onMessage, onResync: vi.fn() })
    ch.emit({ eventType: 'INSERT', new: row })
    ch.emit({ eventType: 'DELETE', new: row })
    ch.emit({ eventType: 'INSERT', new: { id: 'x' } })
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith(row, 'INSERT')
  })
  it('resyncs on reconnect but not on the first connection', async () => {
    const ch = fakeChannel()
    const onResync = vi.fn()
    await subscribeToMessages({ onMessage: vi.fn(), onResync })
    ch.status('SUBSCRIBED')
    expect(onResync).not.toHaveBeenCalled()
    ch.status('CHANNEL_ERROR')
    ch.status('SUBSCRIBED')
    expect(onResync).toHaveBeenCalledTimes(1)
  })
  it('removes the channel on cleanup', async () => {
    fakeChannel()
    const cleanup = await subscribeToMessages({ onMessage: vi.fn(), onResync: vi.fn() })
    cleanup()
    expect(client.removeChannel).toHaveBeenCalledTimes(1)
  })
})
