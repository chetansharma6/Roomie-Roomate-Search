import { describe, expect, it } from 'vitest'
import { DEMO_PROFILE_COUNT, validateSeedEnvironment } from '../scripts/seed-demo-profiles'

const safe = {
  ROOMIE_ALLOW_DEMO_SEED: 'true',
  SUPABASE_URL: 'https://demoproject.supabase.co',
  SUPABASE_SECRET_KEY: 'server-only-test-secret',
  ROOMIE_DEMO_SEED_PROJECT_REF: 'demoproject',
}

describe('fictional profile seeding safeguards', () => {
  it('contains the requested number of fictional candidates', () => {
    expect(DEMO_PROFILE_COUNT).toBe(12)
  })

  it('fails closed unless nonproduction seeding is explicitly acknowledged', () => {
    expect(() => validateSeedEnvironment({ ...safe, ROOMIE_ALLOW_DEMO_SEED: undefined })).toThrow('Refusing to seed')
    expect(() => validateSeedEnvironment({ ...safe, VERCEL_ENV: 'production' })).toThrow('production')
  })

  it('requires an exact hosted demo project ref and server-only secret', () => {
    expect(() => validateSeedEnvironment({ ...safe, ROOMIE_DEMO_SEED_PROJECT_REF: 'anotherproject' })).toThrow('does not match')
    expect(() => validateSeedEnvironment({ ...safe, SUPABASE_SECRET_KEY: undefined })).toThrow('SUPABASE_SECRET_KEY')
    expect(validateSeedEnvironment(safe)).toEqual({
      url: safe.SUPABASE_URL,
      secret: safe.SUPABASE_SECRET_KEY,
    })
  })
})
