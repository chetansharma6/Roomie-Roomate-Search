import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authErrorMessage, getAuthClient, missingAuthSettings, supportedUniversityDomains } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'

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
  const [linkSent, setLinkSent] = useState(false)
  const [profile, setProfile] = useState('')
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  useEffect(() => {
    if (redirectAfterSignIn && !restoring && user && destination) navigate(destination, { replace: true })
  }, [redirectAfterSignIn, restoring, user, destination, navigate])

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || missingAuthSettings.length) return
    setMessage('')
    setLinkSent(false)
    setLoading(true)
    try {
      await sendMagicLink(email)
      setLinkSent(true)
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { setLoading(false) }
  }

  async function handleSignOut() {
    setLoading(true)
    try {
      await signOut()
      setInsight('')
      setProfile('')
      setLinkSent(false)
      setMessage('')
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { setLoading(false) }
  }

  async function requestInsights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setInsight('')
    setInsightLoading(true)

    try {
      const client = await getAuthClient()
      const { data, error } = await client.functions.invoke<RoommateInsightsResponse>(
        'roommate-insights',
        { body: { profile } },
      )
      if (error || !data?.insight) throw error ?? new Error('Missing insight')
      setInsight(data.insight)
    } catch {
      setMessage('Roommate insights are unavailable right now. Please try again.')
    } finally {
      setInsightLoading(false)
    }
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

            {destination === '/discover' && <p><Link to="/profile">Edit your saved roommate profile</Link></p>}

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
              onChange={(event) => {
                setEmail(event.target.value)
                setLinkSent(false)
                setMessage('')
              }}
              disabled={loading}
              required
            />
            <small className="auth-hint">
              Approved domains: {allowedEmailDomains.join(', ') || 'not configured'}.
              Email verification is required.
            </small>
            {missingAuthSettings.length > 0 && (
              <p className="message" role="status">
                University sign-in needs Supabase configuration. In local development, set{' '}
                <code>{missingAuthSettings.join(', ')}</code> in <code>.env.local</code> and restart the dev server.
              </p>
            )}
            <button type="submit" disabled={loading || missingAuthSettings.length > 0}>
              {loading ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        {session && <p><Link className="text-link" to="/discover">Find roommates</Link></p>}
        <p><Link className="text-link" to="/discover?demo=1">Explore demo matches</Link> (fictional profiles)</p>

        {!session && linkSent && <p role="status" className="message">Check your university inbox for the sign-in link.</p>}
        {message && <p role="alert" className="message">{message}</p>}
        {authError && <p role="alert" className="message">{authError} <button type="button" onClick={() => void refresh()}>Retry session</button></p>}
      </section>
    </main>
  )
}
