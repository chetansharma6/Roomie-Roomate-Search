import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getAuthClient: vi.fn() }))
vi.mock('../src/lib/auth', () => mocks)

import { generateRoommateInsights } from '../src/lib/aiInsights'

const targetId = '00000000-0000-4000-8000-000000000002'
const insights = {
  summary: 'Their budgets and move-in dates may align well. Their shared preference for a quiet home could be useful to discuss.',
  strengths: ['Their budgets overlap.', 'Their move-in timing is close.'],
  potential_conflicts: ['Their guest preferences may be worth discussing.'],
  conversation_starters: ['How do you prefer to divide chores?', 'What does a quiet evening look like to you?', 'How often do you expect overnight guests?'],
}

beforeEach(() => { vi.clearAllMocks() })

describe('generateRoommateInsights', () => {
  it('sends only targetProfileId to the authenticated Edge Function and returns typed insights', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { insights, source: 'gemini', model: 'gemini-test' }, error: null })
    mocks.getAuthClient.mockResolvedValue({ functions: { invoke } })
    await expect(generateRoommateInsights(targetId)).resolves.toEqual(insights)
    expect(invoke).toHaveBeenCalledWith('roommate-insights', { body: { targetProfileId: targetId } })
    expect(JSON.stringify(invoke.mock.calls[0])).not.toContain('bio')
  })

  it.each([[401, 'unauthorized'], [404, 'missing_profile'], [429, 'rate_limited']])('maps function status %i to %s', async (status, kind) => {
    mocks.getAuthClient.mockResolvedValue({ functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { context: { status } } }) } })
    await expect(generateRoommateInsights(targetId)).rejects.toMatchObject({ kind })
  })

  it('rejects malformed ids, malformed responses, and network failures safely', async () => {
    await expect(generateRoommateInsights('not-an-id')).rejects.toMatchObject({ kind: 'invalid_response' })
    mocks.getAuthClient.mockResolvedValue({ functions: { invoke: vi.fn().mockResolvedValue({ data: { insights: { ...insights, conversation_starters: [] }, source: 'gemini', model: 'm' }, error: null }) } })
    await expect(generateRoommateInsights(targetId)).rejects.toMatchObject({ kind: 'invalid_response' })
    mocks.getAuthClient.mockRejectedValue(new Error('offline'))
    await expect(generateRoommateInsights(targetId)).rejects.toMatchObject({ kind: 'network' })
  })
})
