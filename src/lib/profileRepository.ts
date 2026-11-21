import { DEMO_PROFILES } from '../data/demoProfiles.js';
import type { RoommateProfile } from '../types/profile.js';

/**
 * The single seam between matching logic and where profiles live.
 * Demo mode uses the in-memory adapter below; Supabase uses
 * api/_lib/supabase.ts. Matching code never touches storage directly.
 */
export interface ProfileRepository {
  getProfile(id: string): Promise<RoommateProfile | null>;
  /** All profiles at a university (the caller applies hard filters and excludes the requester). */
  listProfiles(universityId: string): Promise<RoommateProfile[]>;
}

export function createDemoRepository(profiles: RoommateProfile[] = DEMO_PROFILES): ProfileRepository {
  return {
    async getProfile(id) {
      return profiles.find((p) => p.id === id) ?? null;
    },
    async listProfiles(universityId) {
      return profiles.filter((p) => p.universityId === universityId);
    },
  };
}
