/**
 * Minimal Supabase access over REST (no extra dependency).
 * NOTE: written against the documented Supabase Auth / PostgREST APIs but not
 * exercised against a live project in this repo yet.
 */
import { rowToProfile } from '../../src/lib/profileMapper.js';
import type { ProfileRepository } from '../../src/lib/profileRepository.js';

export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function isSupabaseConfigured(env: SupabaseEnv): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Verifies a user's access token with Supabase Auth and returns their user id. */
export async function verifyAccessToken(
  token: string,
  env: SupabaseEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY ?? '', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: unknown };
    return typeof user.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}

export function createSupabaseRepository(env: SupabaseEnv, fetchImpl: typeof fetch = fetch): ProfileRepository {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  };
  async function query(qs: string): Promise<Record<string, unknown>[]> {
    const res = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/profiles?${qs}`, { headers });
    if (!res.ok) throw new Error(`profiles query failed (${res.status})`);
    return (await res.json()) as Record<string, unknown>[];
  }
  return {
    async getProfile(id) {
      const rows = await query(`id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
      return rows[0] ? rowToProfile(rows[0]) : null;
    },
    async listProfiles(universityId) {
      const rows = await query(`university_id=eq.${encodeURIComponent(universityId)}&select=*&limit=500`);
      return rows.map(rowToProfile).filter((p): p is NonNullable<typeof p> => p !== null);
    },
  };
}
