import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { DataAccessError } from '../lib/dataAccess'
import { getMyProfile, upsertMyProfile } from '../lib/profiles'
import type { ProfileRow } from '../types/database'
import type {
  AcademicYear,
  Cleanliness,
  Dealbreaker,
  GuestFrequency,
  NoiseTolerance,
  PetPreference,
  RoomType,
  SleepSchedule,
  SmokingPreference,
  StudyEnvironment,
} from '../types/profile'

type FormValues = {
  displayName: string
  major: string
  academicYear: AcademicYear | ''
  bio: string
  budgetMin: string
  budgetMax: string
  distance: string
  roommatesWanted: string
  moveInDate: string
  housingStatus: 'have_room' | 'need_room'
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
  isActive: boolean
}

const fromRow = (row: ProfileRow): FormValues => ({
  displayName: row.display_name,
  major: row.major ?? '',
  academicYear: row.academic_year ?? '',
  bio: row.bio ?? '',
  budgetMin: String(row.budget_min),
  budgetMax: String(row.budget_max),
  distance: String(row.distance_from_campus_miles),
  roommatesWanted: String(row.roommates_wanted),
  moveInDate: row.move_in_date?.slice(0, 10) ?? '',
  housingStatus: row.housing_status,
  monthlyRent: row.monthly_rent === null ? '' : String(row.monthly_rent),
  roomType: row.room_type ?? '',
  cleanliness: row.cleanliness ?? '',
  sleepSchedule: row.sleep_schedule ?? '',
  noiseTolerance: row.noise_tolerance ?? '',
  studyEnvironment: row.study_environment ?? '',
  guestFrequency: row.guest_frequency ?? '',
  petPreference: row.pet_preference ?? '',
  smoking: row.smoking ?? '',
  interests: row.interests.join(', '),
  dealbreakers: row.dealbreakers,
  isActive: row.is_active,
})

const optional = <T extends string>(value: T | ''): T | null => value || null

export function ProfileEditor() {
  const { loading: authLoading, user, refresh } = useAuth()
  const [form, setForm] = useState<FormValues | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    void getMyProfile().then((profile) => {
      if (!active) return
      if (!profile) setMissing(true)
      else setForm(fromRow(profile))
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof DataAccessError ? cause.message : 'Could not load your profile. Please retry.')
    })
    return () => { active = false }
  }, [user])

  if (authLoading) return <main className="shell route-notice" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/signup" replace />
  if (missing) return <Navigate to="/onboarding" replace />

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  function toggleDealbreaker(value: Dealbreaker) {
    setForm((current) => current ? {
      ...current,
      dealbreakers: current.dealbreakers.includes(value)
        ? current.dealbreakers.filter((item) => item !== value)
        : [...current.dealbreakers, value],
    } : current)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || saving) return
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const saved = await upsertMyProfile({
        display_name: form.displayName,
        major: optional(form.major),
        academic_year: optional(form.academicYear),
        bio: optional(form.bio),
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
        is_active: form.isActive,
      })
      setForm(fromRow(saved))
      await refresh()
      setMessage('Your profile has been saved.')
    } catch (cause) {
      setError(cause instanceof DataAccessError ? cause.message : 'Could not save your profile. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  if (error && !form) return <main className="shell route-notice" id="main-content"><p role="alert">{error}</p><Link to="/account">Back to account</Link></main>
  if (!form) return <main className="shell route-notice" id="main-content" role="status">Loading your profile…</main>

  return (
    <main className="shell route-notice" id="main-content">
      <h1>Edit your roommate profile</h1>
      <p>Changes are stored in Supabase and used the next time you request matches.</p>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-fields">
          <label>Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} maxLength={100} required /></label>
          <label>Housing situation<select value={form.housingStatus} onChange={(event) => update('housingStatus', event.target.value as FormValues['housingStatus'])} required>
            <option value="need_room">I need a room</option><option value="have_room">I have a room</option>
          </select></label>
          <label>Minimum monthly budget ($)<input type="number" min="0" max="100000" step="1" value={form.budgetMin} onChange={(event) => update('budgetMin', event.target.value)} required /></label>
          <label>Maximum monthly budget ($)<input type="number" min="0" max="100000" step="1" value={form.budgetMax} onChange={(event) => update('budgetMax', event.target.value)} required /></label>
          <label>Maximum distance from campus (miles)<input type="number" min="0" max="1000" step="0.1" value={form.distance} onChange={(event) => update('distance', event.target.value)} required /></label>
          <label>Roommates wanted<input type="number" min="1" max="20" step="1" value={form.roommatesWanted} onChange={(event) => update('roommatesWanted', event.target.value)} required /></label>
          <label>Move-in date<input type="date" value={form.moveInDate} onChange={(event) => update('moveInDate', event.target.value)} required /></label>
          {form.housingStatus === 'have_room' && <label>Monthly rent for the room ($)<input type="number" min="0" max="100000" step="1" value={form.monthlyRent} onChange={(event) => update('monthlyRent', event.target.value)} /></label>}
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
        <label><input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} /> Show my profile to eligible students</label>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="profile-form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving changes…' : 'Save changes'}</button>
          <Link className="button button-outline" to="/discover">Back to discovery</Link>
        </div>
      </form>
    </main>
  )
}
