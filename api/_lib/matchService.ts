import { createHash } from 'node:crypto';
import { DEMO_STUDENT_ID } from '../../src/data/demoProfiles.js';
import { filterCandidates } from '../../src/lib/filters.js';
import { matchRequestSchema } from '../../src/lib/matchSchema.js';
import { createDemoRepository, type ProfileRepository } from '../../src/lib/profileRepository.js';
import { rankBaseline } from '../../src/lib/scoring.js';
import {
  SCORE_DISCLAIMER,
  type FallbackReason,
  type MatchResponse,
  type RoommateProfile,
} from '../../src/types/profile.js';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiFailure,
  MAX_CANDIDATES_PER_REQUEST,
  analyzeWithGemini,
  type GenerateFn,
} from './gemini.js';
import { createSupabaseRepository, isSupabaseConfigured, verifyAccessToken, type SupabaseEnv } from './supabase.js';

export interface MatchEnv extends SupabaseEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ROOMIE_DEMO_MODE?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}

export interface MatchDeps {
  generate?: GenerateFn;
  fetchImpl?: typeof fetch;
  demoRepository?: ProfileRepository;
  now?: () => number;
  timeoutMs?: number;
}

export interface MatchInput {
  method: string;
  body: unknown;
  authorization?: string;
  /** Used only to rate-limit unauthenticated demo callers. */
  clientKey?: string;
  env: MatchEnv;
  deps?: MatchDeps;
}

export interface MatchOutput {
  status: number;
  json: MatchResponse | { error: string; message: string };
}

/**
 * Demo mode lets a fictional student call the API without authentication.
 * It must be explicitly enabled and can never be active on a production deployment.
 */
export function isDemoModeEnabled(env: MatchEnv): boolean {
  if (env.ROOMIE_DEMO_MODE !== 'true') return false;
  if (env.VERCEL_ENV === 'production') return false;
  if (env.VERCEL_ENV === undefined && env.NODE_ENV === 'production') return false;
  return true;
}

// ---- per-instance request limiting and response caching -------------------
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 5 * 60_000;
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; response: MatchResponse }>();

export function resetMatchState(): void {
  hits.clear();
  cache.clear();
}

function rateLimited(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/** Public cards for the profiles a response refers to (server-authoritative; bio capped). */
function cardsFor(matches: { profileId: string }[], pool: RoommateProfile[]): RoommateProfile[] {
  const byId = new Map(pool.map((p) => [p.id, p]));
  return matches.flatMap((m) => {
    const p = byId.get(m.profileId);
    return p ? [{ ...p, bio: p.bio.slice(0, 600) }] : [];
  });
}

const err = (status: number, error: string, message: string): MatchOutput => ({ status, json: { error, message } });

function fallbackResponse(
  requester: RoommateProfile,
  candidates: RoommateProfile[],
  reason: FallbackReason,
): MatchResponse {
  return {
    source: 'fallback',
    fallbackReason: reason,
    matches: rankBaseline(requester, candidates),
    disclaimer: SCORE_DISCLAIMER,
    profiles: cardsFor(rankBaseline(requester, candidates), candidates),
  };
}

export async function runMatch({ method, body, authorization, clientKey, env, deps = {} }: MatchInput): Promise<MatchOutput> {
  const now = deps.now ?? Date.now;
  if (method !== 'POST') return err(405, 'method_not_allowed', 'Use POST.');

  const parsed = matchRequestSchema.safeParse(body ?? {});
  if (!parsed.success) return err(400, 'invalid_request', 'Request body is invalid.');
  const { filters = {}, demoStudentId } = parsed.data;

  // ---- identity: never trust a client-supplied user id outside demo mode ----
  let repo: ProfileRepository;
  let requesterId: string;
  const demo = isDemoModeEnabled(env);
  if (demo) {
    repo = deps.demoRepository ?? createDemoRepository();
    requesterId = demoStudentId ?? DEMO_STUDENT_ID;
  } else {
    if (!isSupabaseConfigured(env)) return err(503, 'not_configured', 'Authentication is not configured.');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return err(401, 'unauthorized', 'Sign in to find matches.');
    const userId = await verifyAccessToken(token, env, deps.fetchImpl);
    if (!userId) return err(401, 'unauthorized', 'Your session is invalid or expired.');
    repo = createSupabaseRepository(env, deps.fetchImpl);
    requesterId = userId;
  }

  if (rateLimited(`${demo ? 'demo' : 'user'}:${requesterId}:${demo ? (clientKey ?? '') : ''}`, now())) {
    return err(429, 'rate_limited', 'Too many match requests. Please wait a minute and try again.');
  }

  let requester: RoommateProfile | null;
  let everyone: RoommateProfile[];
  try {
    requester = await repo.getProfile(requesterId);
    if (!requester) return err(404, 'profile_not_found', 'Create your profile before searching for matches.');
    everyone = await repo.listProfiles(requester.universityId);
  } catch {
    return err(502, 'profile_store_error', 'Could not load profiles.');
  }

  // Hard constraints; university is always the requester's, whatever the client sent.
  const eligible = filterCandidates(everyone, { ...filters, universityId: requester.universityId }, requester);
  if (eligible.length === 0) {
    return { status: 200, json: { source: 'fallback', matches: [], disclaimer: SCORE_DISCLAIMER, profiles: [] } };
  }

  const baselineRanked = rankBaseline(requester, eligible);
  const byId = new Map(eligible.map((c) => [c.id, c]));
  const topCandidates = baselineRanked
    .slice(0, MAX_CANDIDATES_PER_REQUEST)
    .map((m) => byId.get(m.profileId))
    .filter((c): c is RoommateProfile => Boolean(c));

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return { status: 200, json: fallbackResponse(requester, eligible, 'no_api_key') };

  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const cacheKey = createHash('sha256').update(JSON.stringify([model, requester, topCandidates])).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached && now() - cached.at < CACHE_TTL_MS) return { status: 200, json: cached.response };

  try {
    const matches = await analyzeWithGemini(requester, topCandidates, {
      apiKey,
      model,
      generate: deps.generate,
      timeoutMs: deps.timeoutMs,
    });
    const response: MatchResponse = { source: 'gemini', model, matches, disclaimer: SCORE_DISCLAIMER, profiles: cardsFor(matches, topCandidates) };
    cache.set(cacheKey, { at: now(), response });
    return { status: 200, json: response };
  } catch (e) {
    const reason: FallbackReason = e instanceof GeminiFailure ? e.kind : 'ai_error';
    console.warn(`[match] Gemini unavailable, using fallback (${reason})`);
    return { status: 200, json: fallbackResponse(requester, eligible, reason) };
  }
}
