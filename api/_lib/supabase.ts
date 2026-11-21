/**
 * User-scoped Supabase access over REST. Every profile query is subject to RLS.
 * NOTE: written against the documented Supabase Auth / PostgREST APIs but not
 * exercised against a live project in this repo yet.
 */
import { rowToProfile } from '../../src/lib/profileMapper.js';
import type { ProfileRepository } from '../../src/lib/profileRepository.js';

/** Variable names follow the team's .env.example. */
export interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy server setting, unused here: profile reads must use the user's JWT. */
  SUPABASE_SECRET_KEY?: string;
}

export function isSupabaseConfigured(env: SupabaseEnv): boolean {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

/** Verifies a user's access token with Supabase Auth and returns their user id. */
export async function verifyAccessToken(
  token: string,
  env: SupabaseEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: unknown; email_confirmed_at?: unknown };
    return typeof user.id === 'string' && user.id.length > 0 &&
      typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0
      ? user.id : null;
  } catch {
    return null;
  }
}

export function createSupabaseRepository(env: SupabaseEnv, accessToken: string, fetchImpl: typeof fetch = fetch): ProfileRepository {
  if (!accessToken.trim()) throw new Error('A user access token is required');
  const headers = {
    apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    Authorization: `Bearer ${accessToken}`,
  };
  // Explicit projection prevents future private columns from reaching matching.
  const columns = 'id,university_id,display_name,bio,photo_url,budget_min,budget_max,distance_from_campus_miles,move_in_date,roommates_wanted,housing_status,verified_university_email,monthly_rent,room_type,cleanliness,sleep_schedule,noise_tolerance,study_environment,guest_frequency,pet_preference,smoking,interests,dealbreakers,major,academic_year';
  async function query(qs: string): Promise<Record<string, unknown>[]> {
    const res = await fetchImpl(`${env.VITE_SUPABASE_URL}/rest/v1/profiles?${qs}`, { headers });
    if (!res.ok) throw new Error(`profiles query failed (${res.status})`);
    return (await res.json()) as Record<string, unknown>[];
  }
  return {
    async getProfile(id) {
      const rows = await query(`id=eq.${encodeURIComponent(id)}&is_active=eq.true&select=${columns}&limit=1`);
      return rows[0] ? rowToProfile(rows[0]) : null;
    },
    async listProfiles(universityId) {
      const rows = await query(`university_id=eq.${encodeURIComponent(universityId)}&is_active=eq.true&select=${columns}&limit=500`);
      return rows.map(rowToProfile).filter((p): p is NonNullable<typeof p> => p !== null);
    },
  };
}
