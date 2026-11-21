import { GoogleGenAI } from '@google/genai';
import { geminiJsonSchema, validateGeminiMatches } from '../../src/lib/matchSchema.js';
import type { MatchResult, RoommateProfile } from '../../src/types/profile.js';
import { ROOMIE_SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const MAX_CANDIDATES_PER_REQUEST = 10;
export const GEMINI_TIMEOUT_MS = 20_000;

export type GeminiFailureKind = 'rate_limited' | 'timeout' | 'invalid_ai_response' | 'ai_error';

export class GeminiFailure extends Error {
  constructor(
    public readonly kind: GeminiFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'GeminiFailure';
  }
}

export interface GenerateArgs {
  apiKey: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  signal: AbortSignal;
}

/** Returns the raw JSON text from the model. Replaceable in tests. */
export type GenerateFn = (args: GenerateArgs) => Promise<string>;

export const sdkGenerate: GenerateFn = async ({ apiKey, model, systemInstruction, prompt, jsonSchema, signal }) => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema,
      temperature: 0.4,
      abortSignal: signal,
    },
  });
  return response.text ?? '';
};

function classify(err: unknown, aborted: boolean): GeminiFailure {
  if (err instanceof GeminiFailure) return err;
  if (aborted) return new GeminiFailure('timeout', 'Gemini request timed out');
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : '';
  if (status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(message)) {
    return new GeminiFailure('rate_limited', 'Gemini rate limit reached');
  }
  if (err instanceof Error && (err.name === 'AbortError' || /abort|timed? ?out/i.test(message))) {
    return new GeminiFailure('timeout', 'Gemini request timed out');
  }
  // Do not echo provider messages: they can contain request details.
  return new GeminiFailure('ai_error', 'Gemini request failed');
}

export interface AnalyzeOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  generate?: GenerateFn;
}

/**
 * Sends up to 10 pre-filtered candidates to Gemini and returns validated,
 * ranked matches. Throws GeminiFailure on any problem so the caller can fall
 * back to deterministic scoring.
 */
export async function analyzeWithGemini(
  requester: RoommateProfile,
  candidates: RoommateProfile[],
  { apiKey, model = DEFAULT_GEMINI_MODEL, timeoutMs = GEMINI_TIMEOUT_MS, generate = sdkGenerate }: AnalyzeOptions,
): Promise<MatchResult[]> {
  const limited = candidates.slice(0, MAX_CANDIDATES_PER_REQUEST);
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new GeminiFailure('timeout', 'Gemini request timed out'));
    }, timeoutMs);
  });

  try {
    const raw = await Promise.race([
      generate({
        apiKey,
        model,
        systemInstruction: ROOMIE_SYSTEM_INSTRUCTION,
        prompt: buildUserPrompt(requester, limited),
        jsonSchema: geminiJsonSchema(),
        signal: controller.signal,
      }),
      timeout,
    ]);
    const outcome = validateGeminiMatches(raw, new Set(limited.map((c) => c.id)));
    if (outcome.ok === false) throw new GeminiFailure('invalid_ai_response', outcome.reason);
    return outcome.matches;
  } catch (err) {
    throw classify(err, timedOut);
  } finally {
    clearTimeout(timer);
  }
}
