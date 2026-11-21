import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authErrorMessage, supportedUniversityDomains } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'
import Discover from './Discover'

interface RoommateInsightsResponse {
  insight: string
}

const allowedEmailDomains = supportedUniversityDomains

export default function SignIn({ redirectAfterSignIn = true }: { redirectAfterSignIn?: boolean }) {
  const { session, user, loading: restoring, error: authError, destination, sendMagicLink, signOut, refresh } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [profile, setProfile] = useState('')
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  useEffect(() => {
    if (redirectAfterSignIn && !restoring && user && destination) navigate(destination, { replace: true })
  }, [redirectAfterSignIn, restoring, user, destination, navigate])

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    setLoading(true)
    try {
      await sendMagicLink(email)
      setMessage('Check your email for the secure sign-in link.')
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { setLoading(false) }
  }

  async function handleSignOut() {
    setLoading(true)
    try {
      await signOut()
      setInsight('')
      setProfile('')
      setMessage('')
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { setLoading(false) }
  }

  async function requestInsights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setInsight('')
    setInsightLoading(true)

    const { data, error } = await supabase.functions.invoke<RoommateInsightsResponse>(
      'roommate-insights',
      { body: { profile } },
    )

    if (error || !data?.insight) {
      setMessage('Roommate insights are unavailable right now. Please try again.')
    } else {
      setInsight(data.insight)
    }

    setInsightLoading(false)
  }

  if (showDiscover) {
    return (
      <main id="main-content" className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <button type="button" className="button button-outline" onClick={() => setShowDiscover(false)}>
            ← Back
          </button>
        </div>
        {/* TODO(Person 2): load the signed-in student's profile + candidate profiles from Supabase and
            pass them as currentUser / profiles. Until then a signed-in user sees "create your profile";
            signed-out visitors get the fictional demo (requires ROOMIE_DEMO_MODE on the server). */}
        {session ? (
          <Discover currentUser={null} accessToken={session.access_token} />
        ) : (
          <Discover />
        )}
      </main>
    )
  }

  return (
    <main id="main-content" className="sign-in">
      <section className="card" aria-labelledby="page-title">
        <span className="eyebrow">Student housing, made simpler</span>
        <h1 id="page-title">Roomie</h1>
        <p className="intro">
          Find compatible people to share a place with, using the details that
          matter: budget, timing, location, and daily routines.
        </p>

        {restoring ? (
          <p role="status">Connecting securely…</p>
        ) : session ? (
          <div className="member-area">
            <div className="session-bar">
              <p>
                Signed in as <strong>{session.user.email}</strong>
              </p>
              <button className="secondary" type="button" onClick={handleSignOut} disabled={loading}>
                Sign out
              </button>
            </div>

            <form className="insights-form" onSubmit={requestInsights}>
              <div>
                <span className="eyebrow">AI roommate insights</span>
                <h2>Turn your preferences into better questions</h2>
                <p className="helper-text">
                  Describe your budget, schedule, location, and everyday living
                  preferences. Don’t include names, contact details, or exact addresses.
                </p>
              </div>
              <label htmlFor="profile">Your roommate preferences</label>
              <textarea
                id="profile"
                name="profile"
                minLength={20}
                maxLength={4000}
                placeholder="I’m looking for a place near campus under $900. I study late, prefer a quiet home, and am comfortable with cats…"
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
                required
              />
              <div className="form-footer">
                <span>{profile.length}/4000</span>
                <button type="submit" disabled={insightLoading}>
                  {insightLoading ? 'Generating…' : 'Get insights'}
                </button>
              </div>
            </form>

            {insight && (
              <section className="insight" aria-labelledby="insight-title">
                <h2 id="insight-title">Your conversation starter</h2>
                <p>{insight}</p>
                <small>AI-generated suggestions can be incomplete. Verify important housing details yourself.</small>
              </section>
            )}
          </div>
        ) : (
          <form className="auth-panel" onSubmit={requestMagicLink}>
            <label htmlFor="email">University email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={`you@${allowedEmailDomains[0] ?? 'university.edu'}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <small className="auth-hint">
              Approved domains: {allowedEmailDomains.join(', ') || 'not configured'}.
              Email verification is required.
            </small>
            <button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        <p>
          <button type="button" onClick={() => setShowDiscover(true)}>
            {session ? 'Find roommates' : 'Explore demo matches (fictional data)'}
          </button>
        </p>

        {message && <p role="alert" className="message">{message}</p>}
        {authError && <p role="alert" className="message">{authError} <button type="button" onClick={() => void refresh()}>Retry session</button></p>}
      </section>
    </main>
  )
}
