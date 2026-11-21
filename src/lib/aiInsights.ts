import { z } from 'zod'
import { getAuthClient } from './auth'

export const roommateInsightsSchema = z.object({
  summary: z.string().trim().min(1).max(700),
  strengths: z.array(z.string().trim().min(1).max(400)).min(2).max(3),
  potential_conflicts: z.array(z.string().trim().min(1).max(400)).min(1).max(3),
  conversation_starters: z.array(z.string().trim().min(1).max(400)).length(3),
}).strict()
export type RoommateInsights = z.infer<typeof roommateInsightsSchema>

export class AiInsightsError extends Error {
  constructor(public readonly kind: 'unauthorized' | 'missing_profile' | 'rate_limited' | 'unavailable' | 'invalid_response' | 'network', message: string) { super(message); this.name = 'AiInsightsError' }
}

const responseSchema = z.object({ insights: roommateInsightsSchema, source: z.literal('gemini'), model: z.string().min(1) }).strict()

/** Calls the authenticated Edge Function. The browser submits only a profile UUID. */
export async function generateRoommateInsights(targetProfileId: string): Promise<RoommateInsights> {
  if (!z.uuid().safeParse(targetProfileId).success) throw new AiInsightsError('invalid_response', 'Choose a valid student profile.')
  try {
    const client = await getAuthClient()
    const { data, error } = await client.functions.invoke('roommate-insights', { body: { targetProfileId } })
    if (error) {
      const status = error.context?.status
      if (status === 401) throw new AiInsightsError('unauthorized', 'Sign in to generate AI insights.')
      if (status === 404) throw new AiInsightsError('missing_profile', 'That student profile is unavailable for insights.')
      if (status === 429) throw new AiInsightsError('rate_limited', 'Please wait a minute before generating more insights.')
      throw new AiInsightsError('unavailable', 'AI insights are unavailable right now. Please try again.')
    }
    const parsed = responseSchema.safeParse(data)
    if (!parsed.success) throw new AiInsightsError('invalid_response', 'AI insights returned an invalid response. Please try again.')
    return parsed.data.insights
  } catch (error) {
    if (error instanceof AiInsightsError) throw error
    throw new AiInsightsError('network', 'Could not reach AI insights. Check your connection and retry.')
  }
}
