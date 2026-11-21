import { describe, expect, it } from 'vitest'
import { isAllowedRoomieOrigin } from '../supabase/functions/roommate-insights/cors'
import { parseInsightOutput } from '../supabase/functions/roommate-insights/validation'

const validInsight = {
  summary: 'Your move-in timing may align. Your preferences could make a good starting point for a conversation.',
  strengths: ['Your schedules may align.', 'Your budgets may overlap.'],
  potential_conflicts: ['Guest preferences may be worth discussing.'],
  conversation_starters: ['How do you divide chores?', 'What is your ideal quiet evening?', 'How often do you host guests?'],
}

describe('Gemini insight output validation', () => {
  it('parses and returns a valid structured response', () => {
    expect(parseInsightOutput(JSON.stringify(validInsight))).toEqual(validInsight)
  })

  it.each([null, undefined, '', 'not-json', JSON.stringify({ ...validInsight, strengths: [] })])(
    'rejects missing, malformed, or invalid Gemini output: %s',
    (output) => expect(parseInsightOutput(output)).toBeNull(),
  )
})

describe('Roomie Edge Function CORS allowlist', () => {
  const configured = ['http://localhost:5173', 'https://roomie-peach.vercel.app', 'https://roomie-*.vercel.app']

  it('allows configured origins and this Vercel project’s preview hostnames', () => {
    expect(isAllowedRoomieOrigin('http://localhost:5173', configured)).toBe(true)
    expect(isAllowedRoomieOrigin('https://roomie-git-feature-supabase-profiles-chetan.vercel.app', configured)).toBe(true)
  })

  it.each([
    'http://roomie-preview.vercel.app',
    'https://other-project.vercel.app',
    'https://roomie-preview.vercel.app.evil.test',
    'https://roomie-.vercel.app',
  ])('rejects unconfigured or malformed origin %s', (origin) => {
    expect(isAllowedRoomieOrigin(origin, configured)).toBe(false)
  })
})
