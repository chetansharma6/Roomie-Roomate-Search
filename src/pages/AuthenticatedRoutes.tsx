import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getAuthClient } from '../lib/auth'
import { rowToProfile } from '../lib/profileMapper'
import { createProfile } from '../lib/profilePersistence'
import Discover from './Discover'
import type { ProfileWrite } from '../types/database'
import type {
  AcademicYear,
  Cleanliness,
  Dealbreaker,
  GuestFrequency,
  NoiseTolerance,
  PetPreference,
  RoomType,
  RoommateProfile,
  SleepSchedule,
  SmokingPreference,
  StudyEnvironment,
} from '../types/profile'

type ProfileFormValues = {
  displayName: string
  major: string
  academicYear: AcademicYear | ''
  bio: string
  budgetMin: string
  budgetMax: string
  distance: string
  roommatesWanted: string
  moveInDate: string
  housingStatus: '' | 'have_room' | 'need_room'
  monthlyRent: string
  roomType: RoomType | ''
  cleanliness: Cleanliness | ''
  sleepSchedule: SleepSchedule | ''
  noiseTolerance: NoiseTolerance | ''
  studyEnvironment: StudyEnvironment | ''
  guestFrequency: GuestFrequency | ''
  petPreference: PetPreference | ''
  smoking: SmokingPreference | ''
  interests: string
  dealbreakers: Dealbreaker[]
}

const initialForm: ProfileFormValues = {
  displayName: '',
  major: '',
  academicYear: '',
  bio: '',
  budgetMin: '',
  budgetMax: '',
  distance: '',
  roommatesWanted: '',
  moveInDate: '',
  housingStatus: '',
  monthlyRent: '',
  roomType: '',
  cleanliness: '',
  sleepSchedule: '',
  noiseTolerance: '',
  studyEnvironment: '',
  guestFrequency: '',
  petPreference: '',
  smoking: '',
  interests: '',
  dealbreakers: [],
}

const optional = <T extends string>(value: T | ''): T | null => value || null

export function Onboarding() {
  const { loading, user, destination, signOut, refresh } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  if (loading) return <main className="shell route-notice" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/signup" replace />
  if (destination === '/discover') return <Navigate to="/discover" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setError('')
    if (!form.housingStatus) {
      setError('Choose whether you need a room or have one to offer.')
      return
    }
    setSaving(true)
    const profile: ProfileWrite = {
      display_name: form.displayName.trim(),
      major: form.major.trim() || null,
      academic_year: optional(form.academicYear),
      bio: form.bio.trim() || null,
      budget_min: Number(form.budgetMin),
      budget_max: Number(form.budgetMax),
      distance_from_campus_miles: Number(form.distance),
      roommates_wanted: Number(form.roommatesWanted),
      move_in_date: form.moveInDate,
      cleanliness: optional(form.cleanliness),
      sleep_schedule: optional(form.sleepSchedule),
      noise_tolerance: optional(form.noiseTolerance),
      pet_preference: optional(form.petPreference),
      monthly_rent: form.housingStatus === 'have_room' && form.monthlyRent !== '' ? Number(form.monthlyRent) : null,
      room_type: optional(form.roomType),
      study_environment: optional(form.studyEnvironment),
      guest_frequency: optional(form.guestFrequency),
      smoking: optional(form.smoking),
      dealbreakers: form.dealbreakers,
      housing_status: form.housingStatus,
      interests: [...new Set(form.interests.split(',').map((interest) => interest.trim()).filter(Boolean))],
      is_active: true,
    }

    try {
      await createProfile(user.id, profile)
      await refresh()
      navigate('/discover', { replace: true })
    } catch {
      setError('Could not save your profile. Please check your entries and try again.')
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleDealbreaker(value: Dealbreaker) {
    setForm((current) => ({
      ...current,
      dealbreakers: current.dealbreakers.includes(value)
        ? current.dealbreakers.filter((item) => item !== value)
        : [...current.dealbreakers, value],
    }))
  }

  return (
    <main className="shell route-notice" id="main-content">
      <h1>Create your roommate profile</h1>
      <p>Your university email is confirmed. This verifies mailbox ownership, not enrollment.</p>
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
          <label>Room type<select value={form.roomType} onChange={(event) => update('roomType', event.target.value as RoomType | '')}>
            <option value="">No preference</option><option value="private">Private</option><option value="shared">Shared</option><option value="either">Either</option>
          </select></label>
          <label>Cleanliness<select value={form.cleanliness} onChange={(event) => update('cleanliness', event.target.value as Cleanliness | '')}>
            <option value="">No preference</option><option value="relaxed">Relaxed</option><option value="moderate">Moderate</option><option value="tidy">Tidy</option><option value="very_tidy">Very tidy</option>
          </select></label>
          <label>Sleep schedule<select value={form.sleepSchedule} onChange={(event) => update('sleepSchedule', event.target.value as SleepSchedule | '')}>
            <option value="">No preference</option><option value="early_bird">Early bird</option><option value="flexible">Flexible</option><option value="night_owl">Night owl</option>
          </select></label>
          <label>Noise tolerance<select value={form.noiseTolerance} onChange={(event) => update('noiseTolerance', event.target.value as NoiseTolerance | '')}>
            <option value="">No preference</option><option value="quiet">Quiet</option><option value="moderate">Moderate</option><option value="lively">Lively</option>
          </select></label>
          <label>Study environment<select value={form.studyEnvironment} onChange={(event) => update('studyEnvironment', event.target.value as StudyEnvironment | '')}>
            <option value="">No preference</option><option value="silent">Silent</option><option value="quiet">Quiet</option><option value="background_noise_ok">Background noise is okay</option><option value="away_from_home">I study away from home</option>
          </select></label>
          <label>Guest frequency<select value={form.guestFrequency} onChange={(event) => update('guestFrequency', event.target.value as GuestFrequency | '')}>
            <option value="">No preference</option><option value="never">Never</option><option value="rarely">Rarely</option><option value="sometimes">Sometimes</option><option value="often">Often</option>
          </select></label>
          <label>Pets<select value={form.petPreference} onChange={(event) => update('petPreference', event.target.value as PetPreference | '')}>
            <option value="">No preference</option><option value="no_pets">Prefer no pets</option><option value="pets_ok">Pets are okay</option><option value="has_pets">I have pets</option>
          </select></label>
          <label>Smoking<select value={form.smoking} onChange={(event) => update('smoking', event.target.value as SmokingPreference | '')}>
            <option value="">No preference</option><option value="smoke_free">Smoke-free</option><option value="outside_only">Outside only</option><option value="smoker">I smoke</option>
          </select></label>
          <label>Major<input value={form.major} onChange={(event) => update('major', event.target.value)} maxLength={120} /></label>
          <label>Academic year<select value={form.academicYear} onChange={(event) => update('academicYear', event.target.value as AcademicYear | '')}>
            <option value="">Prefer not to say</option><option value="freshman">Freshman</option><option value="sophomore">Sophomore</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="graduate">Graduate</option>
          </select></label>
        </div>
        <label>Bio<textarea value={form.bio} onChange={(event) => update('bio', event.target.value)} maxLength={2000} rows={4} /></label>
        <label>Interests <span>(separate with commas)</span><input value={form.interests} onChange={(event) => update('interests', event.target.value)} /></label>
        <fieldset>
          <legend>Dealbreakers</legend>
          <label><input type="checkbox" checked={form.dealbreakers.includes('no_smoking')} onChange={() => toggleDealbreaker('no_smoking')} /> No smoking</label>
          <label><input type="checkbox" checked={form.dealbreakers.includes('no_pets')} onChange={() => toggleDealbreaker('no_pets')} /> No pets</label>
          <label><input type="checkbox" checked={form.dealbreakers.includes('no_frequent_guests')} onChange={() => toggleDealbreaker('no_frequent_guests')} /> No frequent guests</label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="profile-form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving profile…' : 'Save profile'}</button>
          <button className="button button-outline" type="button" onClick={() => { void signOut().catch(() => setError('Could not sign out. Please retry.')) }}>Sign out</button>
        </div>
      </form>
    </main>
  )
}

export function StudentDiscover() {
  const { user, session } = useAuth()
  const [result, setResult] = useState<{
    userId: string | undefined
    accessToken: string | undefined
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
        'id,university_id,display_name,bio,budget_min,budget_max,distance_from_campus_miles,move_in_date,roommates_wanted,housing_status,verified_university_email,monthly_rent,room_type,cleanliness,sleep_schedule,noise_tolerance,study_environment,guest_frequency,pet_preference,smoking,interests,dealbreakers,major,academic_year,is_active',
      ).limit(500)
      if (queryError) throw queryError
      if (active) setResult({
        userId: user?.id,
        accessToken: session?.access_token,
        attempt,
        profiles: (data ?? []).filter((row) => row.is_active).map(rowToProfile).filter((row): row is RoommateProfile => row !== null),
      })
    })().catch(() => {
      if (active) setResult({ userId: user?.id, accessToken: session?.access_token, attempt, error: 'Could not load student profiles. Please retry.' })
    })
    return () => { active = false }
  }, [user?.id, session?.access_token, attempt])

  const currentResult = result && result.userId === user?.id && result.accessToken === session?.access_token && result.attempt === attempt
    ? result
    : null
  if (currentResult?.error) return <main className="shell route-notice"><p role="alert">{currentResult.error}</p><button onClick={() => setAttempt((n) => n + 1)}>Retry</button></main>
  const profiles = currentResult?.profiles
  if (!profiles) return <main className="shell route-notice" role="status">Loading student profiles…</main>
  const current = profiles.find((profile) => profile.id === user?.id)
  if (!current) return <main className="shell route-notice"><h1>Complete your profile</h1><p>An active profile with a move-in date is needed for discovery.</p><Link to="/account">Account</Link></main>
  return <><div className="shell"><Link to="/account">Account and sign out</Link></div><Discover currentUser={current} profiles={profiles} accessToken={session?.access_token} demoMode={false} /></>
}
