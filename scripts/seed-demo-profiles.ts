import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

const DEMO_DOMAIN = 'roomie-demo.invalid'
const profiles = [
  { name: 'Avery Brooks', budget: [650, 900], distance: 3, date: '2027-01-05', roommates: 2, status: 'need_room', clean: 'tidy', sleep: 'early_bird', noise: 'quiet', guests: 'rarely', pets: 'pets_ok', interests: ['running', 'cooking', 'podcasts'] },
  { name: 'Jordan Lee', budget: [750, 1100], distance: 5, date: '2027-01-12', roommates: 1, status: 'have_room', rent: 925, clean: 'moderate', sleep: 'night_owl', noise: 'moderate', guests: 'sometimes', pets: 'no_pets', interests: ['gaming', 'movies', 'basketball'] },
  { name: 'Maya Patel', budget: [600, 850], distance: 2, date: '2027-01-08', roommates: 2, status: 'need_room', clean: 'very_tidy', sleep: 'early_bird', noise: 'quiet', guests: 'rarely', pets: 'pets_ok', interests: ['yoga', 'reading', 'coffee'] },
  { name: 'Cameron Soto', budget: [800, 1200], distance: 8, date: '2027-02-01', roommates: 1, status: 'have_room', rent: 1050, clean: 'relaxed', sleep: 'flexible', noise: 'lively', guests: 'often', pets: 'has_pets', interests: ['music', 'photography', 'dogs'] },
  { name: 'Taylor Morgan', budget: [700, 950], distance: 4, date: '2027-01-20', roommates: 3, status: 'need_room', clean: 'moderate', sleep: 'flexible', noise: 'moderate', guests: 'sometimes', pets: 'pets_ok', interests: ['soccer', 'coding', 'meal prep'] },
  { name: 'Riley Chen', budget: [900, 1300], distance: 6, date: '2027-02-10', roommates: 1, status: 'have_room', rent: 1125, clean: 'tidy', sleep: 'night_owl', noise: 'quiet', guests: 'never', pets: 'no_pets', interests: ['design', 'chess', 'tea'] },
  { name: 'Morgan Reed', budget: [550, 800], distance: 10, date: '2027-01-15', roommates: 3, status: 'need_room', clean: 'relaxed', sleep: 'night_owl', noise: 'lively', guests: 'often', pets: 'has_pets', interests: ['concerts', 'skating', 'art'] },
  { name: 'Casey Nguyen', budget: [700, 1000], distance: 3, date: '2027-01-03', roommates: 2, status: 'have_room', rent: 875, clean: 'very_tidy', sleep: 'early_bird', noise: 'quiet', guests: 'never', pets: 'no_pets', interests: ['swimming', 'science', 'baking'] },
  { name: 'Sam Rivera', budget: [650, 950], distance: 7, date: '2027-02-05', roommates: 2, status: 'need_room', clean: 'moderate', sleep: 'flexible', noise: 'moderate', guests: 'sometimes', pets: 'pets_ok', interests: ['baseball', 'history', 'cooking'] },
  { name: 'Jamie Wilson', budget: [850, 1250], distance: 4, date: '2027-01-28', roommates: 1, status: 'have_room', rent: 1100, clean: 'tidy', sleep: 'flexible', noise: 'moderate', guests: 'rarely', pets: 'pets_ok', interests: ['theater', 'travel', 'books'] },
  { name: 'Alex Kim', budget: [500, 750], distance: 5, date: '2027-01-10', roommates: 3, status: 'need_room', clean: 'moderate', sleep: 'early_bird', noise: 'quiet', guests: 'rarely', pets: 'no_pets', interests: ['cycling', 'math', 'board games'] },
  { name: 'Drew Thompson', budget: [750, 1050], distance: 9, date: '2027-02-15', roommates: 2, status: 'have_room', rent: 975, clean: 'relaxed', sleep: 'night_owl', noise: 'lively', guests: 'sometimes', pets: 'has_pets', interests: ['film', 'music', 'volunteering'] },
] as const

export const DEMO_PROFILE_COUNT = profiles.length

function projectRef(url: string): string {
  const host = new URL(url).hostname
  const match = host.match(/^([a-z0-9]+)\.supabase\.co$/)
  if (!match) throw new Error('Demo seeding requires a dedicated hosted Supabase project URL.')
  return match[1]!
}

export function validateSeedEnvironment(env: NodeJS.ProcessEnv): { url: string; secret: string } {
  if (env.ROOMIE_ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed. Set ROOMIE_ALLOW_DEMO_SEED=true only for a dedicated nonproduction project.')
  }
  if (env.VERCEL_ENV === 'production') throw new Error('Refusing to seed from a production Vercel environment.')

  const read = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw new Error(`Missing ${name}. See PERSON2_SUPABASE_HANDOFF.md.`)
    return value
  }
  const url = read('SUPABASE_URL')
  const expectedRef = read('ROOMIE_DEMO_SEED_PROJECT_REF')
  if (projectRef(url) !== expectedRef) throw new Error('SUPABASE_URL does not match ROOMIE_DEMO_SEED_PROJECT_REF; refusing to seed.')
  return { url, secret: read('SUPABASE_SECRET_KEY') }
}

async function findOrCreateUser(client: SupabaseClient, email: string): Promise<User> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const existing = data.users.find((user) => user.email?.toLowerCase() === email)
    if (existing) return existing
    if (data.users.length < 1000) break
  }
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { roomie_fixture: true },
  })
  if (error) throw error
  return data.user
}

async function main() {
  const { url, secret } = validateSeedEnvironment(process.env)

  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: domainError } = await client.from('university_domains').upsert({
    domain: DEMO_DOMAIN,
    university_name: 'University of South Florida (fictional demo fixtures)',
    university_id: 'usf',
    is_active: true,
  })
  if (domainError) throw domainError

  for (const [index, fixture] of profiles.entries()) {
    const email = `fixture-${String(index + 1).padStart(2, '0')}@${DEMO_DOMAIN}`
    const user = await findOrCreateUser(client, email)
    const { error } = await client.from('profiles').upsert({
      id: user.id,
      display_name: fixture.name,
      bio: 'Fictional USF roommate profile created for Roomie matching tests.',
      budget_min: fixture.budget[0],
      budget_max: fixture.budget[1],
      distance_from_campus_miles: fixture.distance,
      roommates_wanted: fixture.roommates,
      move_in_date: fixture.date,
      housing_status: fixture.status,
      monthly_rent: 'rent' in fixture ? fixture.rent : null,
      room_type: 'either',
      cleanliness: fixture.clean,
      sleep_schedule: fixture.sleep,
      noise_tolerance: fixture.noise,
      study_environment: fixture.noise === 'quiet' ? 'quiet' : 'background_noise_ok',
      guest_frequency: fixture.guests,
      pet_preference: fixture.pets,
      smoking: 'smoke_free',
      interests: [...fixture.interests],
      dealbreakers: fixture.pets === 'no_pets' ? ['no_pets', 'no_smoking'] : ['no_smoking'],
      is_active: true,
    }, { onConflict: 'id' })
    if (error) throw error
  }

  console.log(`Seeded ${profiles.length} fictional profiles in the approved nonproduction project.`)
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo seeding failed.')
    process.exitCode = 1
  })
}
