import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { rowToProfile } from '../lib/profileMapper'
import { getMyProfile, listProfiles } from '../lib/profiles'
import { StudentDeck } from '../components/discover/StudentDeck'
import type { RoommateProfile } from '../types/profile'

export function StudentDiscover() {
  const { user, session } = useAuth()
  const userId = user?.id
  const [result, setResult] = useState<{
    userId: string | undefined
    attempt: number
    profile?: RoommateProfile | null
    profiles?: RoommateProfile[]
    error?: string
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void (async () => {
      const [ownRow, candidates] = await Promise.all([getMyProfile(), listProfiles()])
      if (active) setResult({
        userId,
        attempt,
        profile: ownRow?.is_active ? rowToProfile({ ...ownRow }) : null,
        profiles: candidates.map((row) => rowToProfile({ ...row })).filter((row): row is RoommateProfile => row !== null),
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
  const current = currentResult.profile
  if (!current || !session) return <main className="shell route-notice"><h1>Complete your profile</h1><p>An active profile with a move-in date is needed for discovery.</p><Link to="/profile">Edit profile</Link></main>
  return <><div className="shell student-desktop-chrome"><Link to="/profile">Edit profile</Link> · <Link to="/account">Account and sign out</Link></div><StudentDeck key={current.id} currentUser={current} profiles={profiles} accessToken={session.access_token} /></>
}
