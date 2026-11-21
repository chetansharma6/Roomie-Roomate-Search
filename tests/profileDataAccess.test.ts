import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toPromptProfile } from '../api/_lib/prompt'
import { rowToProfile } from '../src/lib/profileMapper'
import { getProfileTags } from '../src/lib/profileTags'
import type { ProfileInput } from '../src/lib/profiles'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getAuthClient: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/auth', () => ({
  ...mocks,
  RoomieAuthError: class extends Error { constructor(public code: string, message: string) { super(message) } },
}))
import { getMyProfile, getProfileById, listProfiles, upsertMyProfile } from '../src/lib/profiles'
import { getMyRoommateRequests, respondToRoommateRequest, sendRoommateRequest } from '../src/lib/roommateRequests'

const me = '00000000-0000-4000-8000-000000000001'
const peer = '00000000-0000-4000-8000-000000000002'
const requestId = '00000000-0000-4000-8000-000000000003'
const input: ProfileInput = {
  display_name: ' Student ', budget_min: 500, budget_max: 900,
  distance_from_campus_miles: 3, roommates_wanted: 2, housing_status: 'need_room',
}
type Result = { data: unknown; error: { code: string; message?: string } | null }
let results: Array<Result | Error>
let calls: Array<{ table: string; method: string; args: unknown[] }>

beforeEach(() => {
  vi.clearAllMocks()
  results = []
  calls = []
  mocks.getCurrentUser.mockResolvedValue({ id: me })
  mocks.getAuthClient.mockResolvedValue({ from: mocks.from })
  mocks.from.mockImplementation((table: string) => {
    const result = results.shift() ?? { data: null, error: null }
    const query: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) =>
        (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject),
    }
    for (const method of ['select', 'insert', 'update', 'eq', 'neq', 'or', 'order', 'limit', 'range', 'maybeSingle', 'single']) {
      query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query }
    }
    return query
  })
})

describe('profile data access', () => {
  it('handles a missing profile and always looks up the authenticated owner', async () => {
    expect(await getMyProfile()).toBeNull()
    expect(calls).toContainEqual({ table: 'profiles', method: 'eq', args: ['id', me] })
  })
  it('rejects callers without a session before any database request', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    await expect(listProfiles()).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each([
    { budget_min: 901 }, { budget_min: -1 }, { budget_max: 1.5 },
    { roommates_wanted: 0 }, { roommates_wanted: 21 }, { distance_from_campus_miles: -1 },
    { distance_from_campus_miles: Infinity }, { distance_from_campus_miles: 1001 },
    { bio: 'x'.repeat(2001) }, { display_name: ' ' }, { move_in_date: '2027-02-30' },
    { id: peer }, { verified_university_email: true }, { university_id: 'other' },
  ])('rejects invalid or protected input: %j', async (override) => {
    await expect(upsertMyProfile({ ...input, ...override } as ProfileInput)).rejects.toMatchObject({ code: 'validation' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('updates only writable fields and scopes the update to the authenticated owner', async () => {
    results.push({ data: { id: me, display_name: 'Student' }, error: null })
    expect(await upsertMyProfile(input)).toMatchObject({ id: me })
    const update = calls.find((call) => call.method === 'update')?.args[0] as Record<string, unknown>
    expect(update.display_name).toBe('Student')
    expect(update).not.toHaveProperty('id')
    expect(update).not.toHaveProperty('verified_university_email')
    expect(calls).toContainEqual({ table: 'profiles', method: 'eq', args: ['id', me] })
    expect(calls.some((call) => call.method === 'insert')).toBe(false)
  })
  it('creates a missing profile with a derived owner ID', async () => {
    results.push({ data: null, error: null }, { data: { id: me }, error: null })
    expect(await upsertMyProfile(input)).toEqual({ id: me })
    expect(calls.find((call) => call.method === 'insert')?.args[0]).toMatchObject({ id: me, display_name: 'Student' })
  })
  it('persists exact quiz choices and derives tags without adding them to the matching prompt', async () => {
    const lifestyle_details = {
      temperature: 'warm', bedtime: '10_to_midnight', guests: 'weekly', chores: 'rotate',
      priorities: ['pets', 'quiet'],
    } satisfies NonNullable<ProfileInput['lifestyle_details']>
    const row = {
      ...input, id: me, university_id: 'usf', move_in_date: '2027-01-05',
      sleep_schedule: 'flexible', guest_frequency: 'sometimes', lifestyle_details,
    }
    results.push({ data: row, error: null })
    await upsertMyProfile({ ...input, lifestyle_details, sleep_schedule: 'flexible', guest_frequency: 'sometimes' })
    expect(calls.find((call) => call.method === 'update')?.args[0]).toMatchObject({ lifestyle_details })
    const saved = rowToProfile(row)!
    expect(getProfileTags(saved)).toEqual([
      'Bedtime between 10 and midnight', 'Hosts about once a week', 'Likes a warm home', 'Rotates chores',
    ])
    expect(saved.lifestyleDetails?.priorities).toEqual(['pets', 'quiet'])
    expect(toPromptProfile(saved)).toMatchObject({ sleepSchedule: 'flexible', guestFrequency: 'sometimes' })
    expect(toPromptProfile(saved)).not.toHaveProperty('lifestyleDetails')
  })

  it('rejects duplicate or excess priorities before writing the quiz', async () => {
    const lifestyle = {
      temperature: 'cool', bedtime: 'varies', guests: 'rarely', chores: 'divide',
    } as const
    for (const priorities of [['pets', 'pets'], ['pets', 'quiet', 'guests']] as const) {
      await expect(upsertMyProfile({ ...input, lifestyle_details: { ...lifestyle, priorities: [...priorities] } }))
        .rejects.toMatchObject({ code: 'validation' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('retries an owner update if another tab creates the profile concurrently', async () => {
    results.push({ data: null, error: null }, { data: null, error: { code: '23505' } }, { data: { id: me }, error: null })
    expect(await upsertMyProfile(input)).toEqual({ id: me })
    expect(calls.filter((call) => call.method === 'update')).toHaveLength(2)
  })
  it('filters inactive and own profiles and uses an explicit public-field projection', async () => {
    results.push({ data: [], error: null })
    expect(await listProfiles()).toEqual([])
    expect(calls).toContainEqual({ table: 'profiles', method: 'eq', args: ['is_active', true] })
    expect(calls).toContainEqual({ table: 'profiles', method: 'neq', args: ['id', me] })
    const columns = String(calls.find((call) => call.method === 'select')?.args[0]).split(',')
    expect(columns).not.toContain('*')
    expect(columns).not.toContain('email')
    expect(columns).not.toContain('access_token')
  })
  it('returns null for a profile hidden by RLS; rejects malformed IDs before querying', async () => {
    expect(await getProfileById(peer)).toBeNull()
    await expect(getProfileById('x&select=email')).rejects.toMatchObject({ code: 'validation' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
  it('sanitizes database and network errors', async () => {
    results.push({ data: null, error: { code: '42501', message: 'private provider details' } })
    await expect(getMyProfile()).rejects.toMatchObject({ code: 'forbidden', message: 'You are not allowed to perform this action.' })
    results.push(new TypeError('private connection details'))
    await expect(getMyProfile()).rejects.toMatchObject({ code: 'network' })
  })
})

describe('roommate request data access', () => {
  it('rejects self-requests before writing and creates pending requests without privileged columns', async () => {
    await expect(sendRoommateRequest(me)).rejects.toMatchObject({ code: 'validation' })
    expect(mocks.from).not.toHaveBeenCalled()
    results.push({ data: { id: requestId, status: 'pending' }, error: null })
    expect(await sendRoommateRequest(peer)).toMatchObject({ status: 'pending' })
    expect(calls.find((call) => call.method === 'insert')?.args[0]).toEqual({ sender_id: me, receiver_id: peer })
  })
  it('reports duplicate-pair violations consistently, including concurrent/reverse requests', async () => {
    results.push({ data: null, error: { code: '23505' } })
    await expect(sendRoommateRequest(peer)).rejects.toMatchObject({ code: 'duplicate' })
  })
  it('returns sent and received requests separately and handles empty results', async () => {
    const sent = { id: requestId, sender_id: me, receiver_id: peer }
    const received = { id: 'other', sender_id: peer, receiver_id: me }
    results.push({ data: [sent, received], error: null }, { data: [], error: null })
    expect(await getMyRoommateRequests()).toEqual({ sent: [sent], received: [received] })
    expect(await getMyRoommateRequests()).toEqual({ sent: [], received: [] })
    expect(calls).toContainEqual({ table: 'roommate_requests', method: 'or', args: [`sender_id.eq.${me},receiver_id.eq.${me}`] })
  })
  it('updates only the status of a pending request addressed to the authenticated receiver', async () => {
    results.push({ data: { id: requestId, status: 'accepted' }, error: null })
    expect(await respondToRoommateRequest(requestId, 'accepted')).toMatchObject({ status: 'accepted' })
    expect(calls).toContainEqual({ table: 'roommate_requests', method: 'update', args: [{ status: 'accepted' }] })
    expect(calls).toContainEqual({ table: 'roommate_requests', method: 'eq', args: ['receiver_id', me] })
    expect(calls).toContainEqual({ table: 'roommate_requests', method: 'eq', args: ['status', 'pending'] })
  })
  it('reads request history beyond a single database response page', async () => {
    const sent = { id: requestId, sender_id: me, receiver_id: peer }
    results.push({ data: Array.from({ length: 500 }, () => sent), error: null }, { data: [sent], error: null })
    expect((await getMyRoommateRequests()).sent).toHaveLength(501)
    expect(calls).toContainEqual({ table: 'roommate_requests', method: 'range', args: [500, 999] })
  })
  it('does not treat an unauthorized or already answered zero-row update as success', async () => {
    await expect(respondToRoommateRequest(requestId, 'declined')).rejects.toMatchObject({ code: 'not_found' })
    await expect(respondToRoommateRequest(requestId, 'pending' as 'accepted')).rejects.toMatchObject({ code: 'validation' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})
