import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Star } from 'lucide-react'
import { HousingSetup, initialHousing, type HousingValues } from '../components/onboarding/HousingSetup'
import { lifestyleQuestions, type LifestyleAnswers, type LifestyleQuestion } from '../components/onboarding/lifestyleQuestions'
import { useAuth } from '../hooks/useAuth'
import { DataAccessError } from '../lib/dataAccess'
import { bedtimeForMatching, guestsForMatching, priorityLabels, type LifestylePriority } from '../lib/lifestyleDetails'
import { parseProfilePhotoUrl } from '../lib/profileMapper'
import { getProfileTags } from '../lib/profileTags'
import { upsertMyProfile } from '../lib/profiles'
import './onboarding.css'

const priorityStep = lifestyleQuestions.length
const totalSteps = priorityStep + 1
const priorityOptions = Object.entries(priorityLabels) as [LifestylePriority, string][]
type Screen = number | 'housing' | 'recap'

export function Onboarding() {
  const { loading, user, destination } = useAuth()
  if (loading && !user) return <main className="shell route-notice" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/signup" replace />
  if (destination === '/discover') return <Navigate to="/discover" replace />
  return <OnboardingQuiz key={user.id} />
}

function OnboardingQuiz() {
  const { signOut, refresh } = useAuth()
  const [screen, setScreen] = useState<Screen>(0)
  const [editing, setEditing] = useState(false)
  const [answers, setAnswers] = useState<LifestyleAnswers>({})
  const [priorities, setPriorities] = useState<LifestylePriority[]>([])
  const [housing, setHousing] = useState(initialHousing)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const savingRef = useRef(false)
  const housingBeforeEdit = useRef<HousingValues>(initialHousing)
  const step = typeof screen === 'number' ? screen : undefined
  const question = step === undefined ? undefined : lifestyleQuestions[step]
  const { temperature, cleanliness, bedtime, guests, quiet, chores, pets } = answers
  const preferences = temperature && cleanliness && bedtime && guests && quiet && chores && pets ? {
    cleanliness, sleepSchedule: bedtimeForMatching[bedtime], guestFrequency: guestsForMatching[guests],
    noiseTolerance: quiet, petPreference: pets,
    lifestyleDetails: { temperature, bedtime, guests, chores, priorities },
  } : null

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [screen])

  function navigate(next: Screen, edit = false) {
    setError('')
    setEditing(edit)
    setScreen(next)
  }

  function back() {
    if (editing) {
      if (screen === 'housing') setHousing(housingBeforeEdit.current)
      return navigate('recap')
    }
    if (screen === 'recap') return navigate('housing')
    if (screen === 'housing') return navigate(priorityStep)
    if (screen > 0) navigate(screen - 1)
  }

  function continueQuiz() {
    if (step === undefined || (question && !answers[question.id])) return
    navigate(editing ? 'recap' : step === priorityStep ? 'housing' : step + 1)
  }

  function togglePriority(priority: LifestylePriority) {
    setPriorities((current) => {
      if (current.includes(priority)) return current.filter((item) => item !== priority)
      return current.length < 2 ? [...current, priority] : current
    })
  }

  function updateHousing<K extends keyof HousingValues>(key: K, value: HousingValues[K]) {
    setHousing((current) => ({ ...current, [key]: value }))
  }

  function reviewHousing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!housing.displayName.trim() || Number(housing.budgetMin) > Number(housing.budgetMax)) {
      setError('Enter a display name and a budget range with the minimum at or below the maximum.')
      return
    }
    if (housing.photoUrl.trim() && !parseProfilePhotoUrl(housing.photoUrl.trim())) {
      setError('Enter an HTTPS photo URL without sign-in credentials.')
      return
    }
    navigate('recap')
  }

  async function save() {
    if (savingRef.current || !preferences || !housing.housingStatus) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await upsertMyProfile({
        display_name: housing.displayName.trim(),
        bio: housing.bio.trim() || null,
        photo_url: parseProfilePhotoUrl(housing.photoUrl.trim()) ?? null,
        budget_min: Number(housing.budgetMin),
        budget_max: Number(housing.budgetMax),
        distance_from_campus_miles: Number(housing.distance),
        roommates_wanted: Number(housing.roommatesWanted),
        move_in_date: housing.moveInDate,
        housing_status: housing.housingStatus,
        monthly_rent: housing.housingStatus === 'have_room' && housing.monthlyRent !== '' ? Number(housing.monthlyRent) : null,
        cleanliness: preferences.cleanliness,
        sleep_schedule: preferences.sleepSchedule,
        guest_frequency: preferences.guestFrequency,
        noise_tolerance: preferences.noiseTolerance,
        pet_preference: preferences.petPreference,
        lifestyle_details: preferences.lifestyleDetails,
        is_active: true,
      })
      await refresh()
    } catch (cause) {
      setError(cause instanceof DataAccessError ? cause.message : 'Could not save your profile. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <main className="onboarding-quiz" id="main-content">
      <div className="quiz-shell">
        <header className="quiz-header">
          <h1>What’s it like to live with you?</h1>
          <button className="quiz-sign-out" type="button" disabled={saving} onClick={() => {
            void signOut().catch(() => setError('Could not sign out. Please retry.'))
          }}>Sign out</button>
        </header>
        {step !== undefined && (
          <div className="quiz-progress">
            <span>Step {step + 1} of {totalSteps}</span>
            <progress value={step + 1} max={totalSteps} aria-label="Lifestyle quiz progress" />
          </div>
        )}

        <section className="quiz-screen" key={screen} aria-labelledby="quiz-question-title">
          <h2 id="quiz-question-title" ref={heading} tabIndex={-1}>
            {question?.title ?? (screen === 'housing' ? 'Your housing setup' : screen === 'recap' ? 'Review your profile' : 'What matters most to you?')}
          </h2>
          {question && <Question question={question} selected={answers[question.id]} onSelect={(value) => {
            setAnswers((current) => ({ ...current, [question.id]: value }))
          }} />}
          {step === priorityStep && (
            <fieldset className="quiz-options" aria-labelledby="quiz-question-title" aria-describedby="quiz-priority-count">
              <p className="quiz-priority-count" id="quiz-priority-count">
                Pick up to two habits you prioritize in a roommate. <strong role="status">{priorities.length} of 2 selected</strong>
              </p>
              {priorityOptions.map(([value, label]) => (
                <label className="quiz-option" key={value}>
                  <input type="checkbox" checked={priorities.includes(value)}
                    disabled={priorities.length === 2 && !priorities.includes(value)} onChange={() => togglePriority(value)} />
                  <Star aria-hidden="true" size={20} />
                  <span>{label}</span>
                  <Check className="quiz-option-check" aria-hidden="true" size={18} />
                </label>
              ))}
            </fieldset>
          )}
          {screen === 'housing' && <HousingSetup form={housing} update={updateHousing} onSubmit={reviewHousing} />}
          {screen === 'recap' && (
            <>
              <dl className="quiz-recap">
                {lifestyleQuestions.map(({ id, title, options }, index) => (
                  <div key={id}>
                    <dt>{title}</dt><dd>{options.find(({ value }) => value === answers[id])?.label}</dd>
                    <button type="button" onClick={() => navigate(index, true)} disabled={saving} aria-label={`Edit ${title.toLowerCase()}`}>Edit</button>
                  </div>
                ))}
                <div>
                  <dt>Roommate priorities</dt>
                  <dd>{priorities.length ? priorities.map((id) => priorityLabels[id]).join(', ') : 'No priorities selected'}</dd>
                  <button type="button" onClick={() => navigate(priorityStep, true)} disabled={saving} aria-label="Edit roommate priorities">Edit</button>
                </div>
                <div>
                  <dt>Housing setup</dt>
                  <dd>{housing.housingStatus === 'have_room' ? 'Offering a room' : 'Looking for a home'} · ${housing.budgetMin}–${housing.budgetMax}/month · Move-in {housing.moveInDate}</dd>
                  <button type="button" onClick={() => {
                    housingBeforeEdit.current = housing
                    navigate('housing', true)
                  }} disabled={saving} aria-label="Edit housing setup">Edit</button>
                </div>
              </dl>
              {preferences && (
                <div className="quiz-recap-tags">
                  <h3>Your profile tags</h3>
                  <ul className="student-tags">{getProfileTags(preferences).map((tag) => <li key={tag}>{tag}</li>)}</ul>
                </div>
              )}
            </>
          )}
          {error && <p className="quiz-error" role="alert">{error}</p>}
        </section>
        <div className="quiz-controls">
          <button className="button quiz-back" type="button" onClick={back} disabled={saving || (screen === 0 && !editing)}>
            <ArrowLeft size={18} aria-hidden="true" /> Back
          </button>
          {screen === 'housing' ? (
            <button className="button quiz-continue" type="submit" form="onboarding-housing">Continue <ArrowRight size={18} aria-hidden="true" /></button>
          ) : screen === 'recap' ? (
            <button className="button quiz-continue" type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Find roommates'} <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <button className="button quiz-continue" type="button" disabled={Boolean(question && !answers[question.id])} onClick={continueQuiz}>
              Continue <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

function Question({ question, selected, onSelect }: {
  question: LifestyleQuestion
  selected?: string
  onSelect: (value: string) => void
}) {
  const dial = question.id === 'temperature' ? question.options.find(({ value }) => value === selected)?.dial : undefined
  return (
    <fieldset className="quiz-options" aria-labelledby="quiz-question-title">
      {question.id === 'temperature' && (
        <div className="quiz-thermostat" aria-hidden="true">
          <div className="quiz-dial"><question.icon size={20} /><strong>{dial ?? '—°'}</strong></div>
        </div>
      )}
      {question.options.map(({ value, label, icon: Icon }) => (
        <label className="quiz-option" key={value}>
          <input type="radio" name={question.id} value={value} checked={selected === value} onChange={() => onSelect(value)} />
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
          <Check className="quiz-option-check" size={18} aria-hidden="true" />
        </label>
      ))}
    </fieldset>
  )
}
