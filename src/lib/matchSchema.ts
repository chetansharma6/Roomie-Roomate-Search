import { z } from 'zod';
import type { MatchResult } from '../types/profile.js';

const text = (max: number) => z.string().trim().min(1).max(max);

export const matchResultSchema = z.object({
  profileId: text(128),
  compatibilityScore: z.number().min(0).max(100),
  summary: text(400),
  strengths: z.array(text(160)).min(1).max(3),
  potentialConflicts: z.array(text(200)).max(4),
  conversationStarters: z.array(text(200)).min(1).max(3),
});

export const geminiResponseSchema = z.object({
  matches: z.array(matchResultSchema).min(1).max(10),
});

/** JSON Schema sent to Gemini for structured output (generated from the same Zod schema). */
export function geminiJsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(geminiResponseSchema) as Record<string, unknown>;
  return schema;
}

export const filtersSchema = z
  .object({
    universityId: z.string().max(64).optional(),
    maxMonthlyBudget: z.number().min(0).max(100_000).optional(),
    maxDistanceMiles: z.number().min(0).max(500).optional(),
    housingStatus: z.enum(['has_room', 'needs_room']).optional(),
    roommatesWanted: z.number().int().min(0).max(20).optional(),
    moveInWithinDays: z.number().int().min(0).max(3650).optional(),
    moveInDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    roomType: z.enum(['private', 'shared']).optional(),
    verifiedOnly: z.boolean().optional(),
    cleanliness: z.array(z.enum(['relaxed', 'moderate', 'tidy', 'very_tidy'])).max(4).optional(),
    sleepSchedule: z.array(z.enum(['early_bird', 'flexible', 'night_owl'])).max(3).optional(),
  })
  .strict();

export const matchRequestSchema = z
  .object({
    /** Honoured ONLY when demo mode is enabled server-side. */
    demoStudentId: z.string().max(128).optional(),
    filters: filtersSchema.optional(),
  })
  .strict();

export type MatchRequestBody = z.infer<typeof matchRequestSchema>;

export type ValidationOutcome =
  | { ok: true; matches: MatchResult[] }
  | { ok: false; reason: string };

/**
 * Validates raw Gemini output. Anything unexpected rejects the whole response
 * so the caller can fall back to deterministic scoring: unknown/hallucinated
 * IDs, duplicates, out-of-range scores, missing fields, invalid JSON.
 */
export function validateGeminiMatches(raw: unknown, allowedIds: ReadonlySet<string>): ValidationOutcome {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }
  }
  const parsed = geminiResponseSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: 'schema_mismatch' };

  const seen = new Set<string>();
  for (const m of parsed.data.matches) {
    if (!allowedIds.has(m.profileId)) return { ok: false, reason: 'unknown_profile_id' };
    if (seen.has(m.profileId)) return { ok: false, reason: 'duplicate_profile_id' };
    seen.add(m.profileId);
  }

  const matches = parsed.data.matches
    .map((m) => ({ ...m, compatibilityScore: Math.round(m.compatibilityScore) }))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  return { ok: true, matches };
}

/** Shape of POST /api/match responses, validated by the browser client. */
export const matchResponseSchema = z.object({
  source: z.enum(['gemini', 'fallback']),
  fallbackReason: z
    .enum(['no_api_key', 'rate_limited', 'timeout', 'invalid_ai_response', 'ai_error', 'network_error', 'server_error'])
    .optional(),
  model: z.string().optional(),
  matches: z.array(matchResultSchema),
  disclaimer: z.string(),
});
