import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authErrorMessage, MagicLinkRateLimitError, missingAuthSettings, supportedUniversityDomains } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'

const allowedEmailDomains = supportedUniversityDomains
const untimedRetryPause = 5000

export default function SignIn({ redirectAfterSignIn = true }: { redirectAfterSignIn?: boolean }) {
  const { session, user, loading: restoring, error: authError, destination, signOut, refresh } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (redirectAfterSignIn && !restoring && user && destination) navigate(destination, { replace: true })
  }, [redirectAfterSignIn, restoring, user, destination, navigate])

  async function handleSignOut() {
    setLoading(true)
    try {
      await signOut()
      setMessage('')
    } catch (error) { setMessage(authErrorMessage(error)) }
    finally { setLoading(false) }
  }

  return (
    <main id="main-content" className="sign-in">
      <section className="card" aria-labelledby="page-title">
        <span className="eyebrow">Student housing, made simpler</span>
        <h1 id="page-title">Your people.<br />Your next place.</h1>
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

            <section className="insight" aria-labelledby="insight-title">
              <span className="eyebrow">AI roommate insights</span>
              <h2 id="insight-title">Compare saved profiles, privately</h2>
              <p>Open a student’s profile in Discover and choose “Generate AI Insights” for structured conversation starters based only on both saved profiles.</p>
              <Link className="text-link" to="/discover">Open Discover</Link>
            </section>
          </div>
        ) : (
          <UniversityEmailForm />
        )}

        {session && <p><Link className="text-link" to="/discover">Find roommates</Link></p>}
        <p><Link className="text-link" to="/discover?demo=1">Explore demo matches</Link> (fictional profiles)</p>

        {message && <p role="alert" className="message">{message}</p>}
        {authError && <p role="alert" className="message">{authError} <button type="button" onClick={() => void refresh()}>Retry session</button></p>}
      </section>
    </main>
  )
}

function UniversityEmailForm() {
  const { sendMagicLink } = useAuth()
  const requestInFlight = useRef(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [retry, setRetry] = useState<{ until: number; seconds: number | null } | null>(null)
  const [retryMessage, setRetryMessage] = useState(false)

  useEffect(() => {
    if (!retry) return
    const remaining = Math.max(0, retry.until - Date.now())
    const timer = window.setTimeout(() => {
      const ms = retry.until - Date.now()
      if (ms <= 0) setRetry(null)
      else setRetry({ ...retry, seconds: retry.seconds === null ? null : Math.ceil(ms / 1000) })
    }, retry.seconds === null ? remaining : Math.min(1000, remaining))
    return () => window.clearTimeout(timer)
  }, [retry])

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestInFlight.current || retry || missingAuthSettings.length) return
    requestInFlight.current = true
    setRetryMessage(false)
    setMessage('')
    setLinkSent(false)
    setLoading(true)
    try {
      await sendMagicLink(email)
      setLinkSent(true)
    } catch (error) {
      if (error instanceof MagicLinkRateLimitError) {
        const now = Date.now()
        const until = error.retryAt ?? now + untimedRetryPause
        const seconds = error.retryAt === undefined ? null : Math.ceil((until - now) / 1000)
        if (until > now) setRetry({ until, seconds })
        setRetryMessage(seconds === null || seconds <= 0)
      } else {
        setMessage(authErrorMessage(error))
      }
    } finally {
      requestInFlight.current = false
      setLoading(false)
    }
  }

  return (
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
      <div className="auth-actions">
        <button type="submit" disabled={loading || Boolean(retry) || missingAuthSettings.length > 0}
          aria-describedby={retry || retryMessage ? 'auth-retry' : undefined}>
          {loading ? 'Sending…' : 'Email me a sign-in link'}
        </button>
        <small id="auth-retry" className="auth-hint" role="status" aria-atomic="true">
          {retry?.seconds != null
            ? `You can request another link in ${retry.seconds} second${retry.seconds === 1 ? '' : 's'}.`
            : retryMessage ? 'Try again shortly' : ''}
        </small>
      </div>
      {linkSent && <p role="status" className="message">Check your university inbox for the sign-in link.</p>}
      {message && <p role="alert" className="message">{message}</p>}
    </form>
  )
}
