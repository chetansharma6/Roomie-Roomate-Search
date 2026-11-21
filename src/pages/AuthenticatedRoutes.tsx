import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getAuthClient } from '../lib/auth'
import { parseProfilePhotoUrl, rowToProfile } from '../lib/profileMapper'
import { createProfile } from '../lib/profilePersistence'
import { StudentDeck } from '../components/discover/StudentDeck'
import type { ProfileWrite } from '../types/database'
import type {
  Cleanliness,
  GuestFrequency,
  PetPreference,
  RoommateProfile,
  SleepSchedule,
} from '../types/profile'

type ProfileFormValues = {
  displayName: string
  bio: string
  photoUrl: string
  budgetMin: string
  budgetMax: string
  distance: string
  roommatesWanted: string
  moveInDate: string
  housingStatus: '' | 'have_room' | 'need_room'
  monthlyRent: string
  cleanliness: Cleanliness | ''
  sleepSchedule: SleepSchedule | ''
  guestFrequency: GuestFrequency | ''
  petPreference: PetPreference | ''
}

const initialForm: ProfileFormValues = {
  displayName: '',
  bio: '',
  photoUrl: '',
  budgetMin: '',
  budgetMax: '',
  distance: '',
  roommatesWanted: '1',
  moveInDate: '',
  housingStatus: '',
  monthlyRent: '',
  cleanliness: '',
  sleepSchedule: '',
  guestFrequency: '',
  petPreference: '',
}

const optional = <T extends string>(value: T | ''): T | null => value || null

export function Onboarding() {
  const { loading, user, destination, signOut, refresh } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  if (loading) return <main className="shell route-notice" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/signup" replace />
  if (destination === '/discover') return <Navigate to="/discover" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || saving) return
    setError('')
    if (!form.housingStatus) {
      setError('Choose whether you need a room or have one to offer.')
      return
    }
    if (!form.displayName.trim() || Number(form.budgetMin) > Number(form.budgetMax)) {
      setError('Enter a display name and a budget range with the minimum at or below the maximum.')
      return
    }
    const photoUrl = parseProfilePhotoUrl(form.photoUrl.trim())
    if (form.photoUrl.trim() && !photoUrl) {
      setError('Enter an HTTPS photo URL without sign-in credentials.')
      return
    }
    setSaving(true)
    const profile: ProfileWrite = {
      display_name: form.displayName.trim(),
      bio: form.bio.trim() || null,
      photo_url: photoUrl ?? null,
      budget_min: Number(form.budgetMin),
      budget_max: Number(form.budgetMax),
      distance_from_campus_miles: Number(form.distance),
      roommates_wanted: Number(form.roommatesWanted),
      move_in_date: form.moveInDate,
      cleanliness: optional(form.cleanliness),
      sleep_schedule: optional(form.sleepSchedule),
      pet_preference: optional(form.petPreference),
      monthly_rent: form.housingStatus === 'have_room' && form.monthlyRent !== '' ? Number(form.monthlyRent) : null,
      guest_frequency: optional(form.guestFrequency),
      housing_status: form.housingStatus,
      is_active: true,
    }

    try {
      await createProfile(user.id, profile)
      await refresh()
    } catch {
      setError('Could not save your profile. Please check your entries and try again.')
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="shell route-notice" id="main-content">
      <h1>Tell us what you’re looking for</h1>
      <p>Answer a few questions to create your profile and find compatible roommates.</p>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-fields">
          <label>Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} maxLength={100} required /></label>
          <label>Housing situation<select value={form.housingStatus} onChange={(event) => update('housingStatus', event.target.value as ProfileFormValues['housingStatus'])} required>
            <option value="">Choose one</option><option value="need_room">I need a room</option><option value="have_room">I have a room</option>
          </select></label>
          <label>Minimum monthly budget ($)<input type="number" min="0" step="1" value={form.budgetMin} onChange={(event) => update('budgetMin', event.target.value)} required /></label>
          <label>Maximum monthly budget ($)<input type="number" min="0" step="1" value={form.budgetMax} onChange={(event) => update('budgetMax', event.target.value)} required /></label>
          <label>Maximum distance from campus (miles)<input type="number" min="0" max="1000" step="0.1" value={form.distance} onChange={(event) => update('distance', event.target.value)} required /></label>
          <label>Roommates wanted<input type="number" min="1" max="20" step="1" value={form.roommatesWanted} onChange={(event) => update('roommatesWanted', event.target.value)} required /></label>
          <label>Move-in date<input type="date" value={form.moveInDate} onChange={(event) => update('moveInDate', event.target.value)} required /></label>
          {form.housingStatus === 'have_room' && <label>Monthly rent for the room ($)<input type="number" min="0" step="1" value={form.monthlyRent} onChange={(event) => update('monthlyRent', event.target.value)} /></label>}
          <label>Cleanliness<select value={form.cleanliness} onChange={(event) => update('cleanliness', event.target.value as Cleanliness | '')}>
            <option value="">No preference</option><option value="relaxed">Relaxed</option><option value="moderate">Moderate</option><option value="tidy">Tidy</option><option value="very_tidy">Very tidy</option>
          </select></label>
          <label>Sleep schedule<select value={form.sleepSchedule} onChange={(event) => update('sleepSchedule', event.target.value as SleepSchedule | '')}>
            <option value="">No preference</option><option value="early_bird">Early bird</option><option value="flexible">Flexible</option><option value="night_owl">Night owl</option>
          </select></label>
          <label>Guest frequency<select value={form.guestFrequency} onChange={(event) => update('guestFrequency', event.target.value as GuestFrequency | '')}>
            <option value="">No preference</option><option value="never">Never</option><option value="rarely">Rarely</option><option value="sometimes">Sometimes</option><option value="often">Often</option>
          </select></label>
          <label>Pets<select value={form.petPreference} onChange={(event) => update('petPreference', event.target.value as PetPreference | '')}>
            <option value="">No preference</option><option value="no_pets">Prefer no pets</option><option value="pets_ok">Pets are okay</option><option value="has_pets">I have pets</option>
          </select></label>
        </div>
        <label>Bio<textarea value={form.bio} onChange={(event) => update('bio', event.target.value)} maxLength={2000} rows={4} /></label>
        <label>Profile photo URL (optional)<input type="url" pattern="https://.*" maxLength={2048}
          placeholder="https://…" value={form.photoUrl} onChange={(event) => update('photoUrl', event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="profile-form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving profile…' : 'Save and discover'}</button>
          <button className="button button-outline" type="button" onClick={() => { void signOut().catch(() => setError('Could not sign out. Please retry.')) }}>Sign out</button>
        </div>
      </form>
    </main>
  )
}

export function StudentDiscover() {
  const { user, session } = useAuth()
  const userId = user?.id
  const [result, setResult] = useState<{
    userId: string | undefined
    attempt: number
    profiles?: RoommateProfile[]
    error?: string
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void (async () => {
      const client = await getAuthClient()
      const { data, error: queryError } = await client.from('profiles').select(
        'id,university_id,display_name,bio,photo_url,budget_min,budget_max,distance_from_campus_miles,move_in_date,roommates_wanted,housing_status,verified_university_email,monthly_rent,room_type,cleanliness,sleep_schedule,noise_tolerance,study_environment,guest_frequency,pet_preference,smoking,interests,dealbreakers,major,academic_year,is_active',
      ).limit(500)
      if (queryError) throw queryError
      if (active) setResult({
        userId,
        attempt,
        profiles: (data ?? []).filter((row) => row.is_active).map(rowToProfile).filter((row): row is RoommateProfile => row !== null),
      })
    })().catch(() => {
      if (active) setResult({ userId, attempt, error: 'Could not load student profiles. Please retry.' })
    })
    return () => { active = false }
  }, [userId, attempt])

  const currentResult = result && result.userId === userId && result.attempt === attempt
    ? result
    : null
  if (currentResult?.error) return <main className="shell route-notice"><p role="alert">{currentResult.error}</p><button onClick={() => setAttempt((n) => n + 1)}>Retry</button></main>
  const profiles = currentResult?.profiles
  if (!profiles) return <main className="shell route-notice" role="status">Loading student profiles…</main>
  const current = profiles.find((profile) => profile.id === user?.id)
  if (!current || !session) return <main className="shell route-notice"><h1>Complete your profile</h1><p>An active profile with a move-in date is needed for discovery.</p><Link to="/account">Account</Link></main>
  return <StudentDeck key={current.id} currentUser={current} profiles={profiles} accessToken={session.access_token} />
}
