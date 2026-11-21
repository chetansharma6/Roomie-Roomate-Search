export type Insight = {
  summary: string
  strengths: string[]
  potential_conflicts: string[]
  conversation_starters: string[]
}

function sentences(value: string) {
  return value.trim().split(/[.!?]+(?:\s|$)/).filter(Boolean).length
}

function textList(value: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null
  const items = value.map((item) => typeof item === 'string' ? item.trim() : '')
  return items.every((item) => item.length >= 3 && item.length <= 400) ? items : null
}

export function validateInsight(value: unknown): Insight | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
  const strengths = textList(record.strengths, 2, 3)
  const potentialConflicts = textList(record.potential_conflicts, 1, 3)
  const starters = textList(record.conversation_starters, 3, 3)
  if (!summary || summary.length > 700 || ![2, 3].includes(sentences(summary)) || !strengths || !potentialConflicts || !starters) return null
  return { summary, strengths, potential_conflicts: potentialConflicts, conversation_starters: starters }
}

/** Missing, malformed, and schema-invalid model output all become a safe unavailable result. */
export function parseInsightOutput(outputText: string | null | undefined): Insight | null {
  if (!outputText?.trim()) return null
  try {
    return validateInsight(JSON.parse(outputText))
  } catch {
    return null
  }
}
