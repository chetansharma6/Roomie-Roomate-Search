import { GoogleGenAI } from '@google/genai';
import { geminiJsonSchema, validateGeminiMatches } from '../../src/lib/matchSchema.js';
import type { MatchResult, RoommateProfile } from '../../src/types/profile.js';
import { ROOMIE_SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const MAX_CANDIDATES_PER_REQUEST = 10;
export const GEMINI_TIMEOUT_MS = 20_000;

export type GeminiFailureKind = 'rate_limited' | 'unavailable' | 'timeout' | 'invalid_ai_response' | 'ai_error';

/** Only 429 (rate limit) and 503 (overload) are retried; auth, model and request errors never are. */
export const MAX_GEMINI_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4_000;

export class GeminiFailure extends Error {
  constructor(
    public readonly kind: GeminiFailureKind,
    message: string,
    /** Sanitized provider HTTP status, if any. Never contains provider text. */
    public readonly status?: number,
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
  const rawStatus = (err as { status?: unknown } | null)?.status;
  const status = typeof rawStatus === 'number' ? rawStatus : undefined;
  const message = err instanceof Error ? err.message : '';
  if (status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(message)) {
    return new GeminiFailure('rate_limited', 'Gemini rate limit reached', status);
  }
  if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(message)) {
    return new GeminiFailure('unavailable', 'Gemini is temporarily unavailable', status);
  }
  if (err instanceof Error && (err.name === 'AbortError' || /abort|timed? ?out/i.test(message))) {
    return new GeminiFailure('timeout', 'Gemini request timed out');
  }
  // Do not echo provider messages: they can contain request details.
  return new GeminiFailure('ai_error', 'Gemini request failed', status);
}

export interface AnalyzeOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  generate?: GenerateFn;
  /** Base for exponential backoff between retries (tests use a tiny value). */
  retryBaseDelayMs?: number;
}

function isRetryable(err: unknown): boolean {
  return err instanceof GeminiFailure && (err.kind === 'rate_limited' || err.kind === 'unavailable');
}

/** Exponential backoff with full jitter, aborted early if the overall request is cancelled. */
function backoff(attempt: number, baseMs: number, signal: AbortSignal): Promise<void> {
  const ceiling = Math.min(RETRY_MAX_DELAY_MS, baseMs * 2 ** attempt);
  const delay = Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
  return new Promise((resolve) => {
    const t = setTimeout(resolve, delay);
    signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * Sends up to 10 pre-filtered candidates to Gemini and returns validated,
 * ranked matches. Throws GeminiFailure on any problem so the caller can fall
 * back to deterministic scoring.
 */
export async function analyzeWithGemini(
  requester: RoommateProfile,
  candidates: RoommateProfile[],
  { apiKey, model = DEFAULT_GEMINI_MODEL, timeoutMs = GEMINI_TIMEOUT_MS, generate = sdkGenerate, retryBaseDelayMs = RETRY_BASE_DELAY_MS }: AnalyzeOptions,
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
    const args: GenerateArgs = {
      apiKey,
      model,
      systemInstruction: ROOMIE_SYSTEM_INSTRUCTION,
      prompt: buildUserPrompt(requester, limited),
      jsonSchema: geminiJsonSchema(),
      signal: controller.signal,
    };
    // Retries share the single overall time budget (the timeout below aborts everything).
    const attemptWithRetries = async (): Promise<string> => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await generate(args);
        } catch (err) {
          const failure = classify(err, false);
          if (!isRetryable(failure) || attempt >= MAX_GEMINI_RETRIES || controller.signal.aborted) throw failure;
          await backoff(attempt, retryBaseDelayMs, controller.signal);
          if (controller.signal.aborted) throw failure;
        }
      }
    };
    const raw = await Promise.race([attemptWithRetries(), timeout]);
    const outcome = validateGeminiMatches(raw, new Set(limited.map((c) => c.id)));
    if (outcome.ok === false) throw new GeminiFailure('invalid_ai_response', outcome.reason);
    return outcome.matches;
  } catch (err) {
    throw classify(err, timedOut);
  } finally {
    clearTimeout(timer);
  }
}
