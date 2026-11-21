import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Discover from './pages/Discover'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDiscover, setShowDiscover] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    setMessage(error ? error.message : 'Check your email for the secure sign-in link.')
    setLoading(false)
  }

  async function signOut() {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    setMessage(error?.message ?? '')
    setLoading(false)
  }

  if (showDiscover) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <button type="button" onClick={() => setShowDiscover(false)}>
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
      </div>
    )
  }

  return (
    <main>
      <section className="card" aria-labelledby="page-title">
        <span className="eyebrow">Student housing, made simpler</span>
        <h1 id="page-title">Roomie</h1>
        <p className="intro">
          Find compatible people to share a place with, using the details that
          matter: budget, timing, location, and daily routines.
        </p>

        {loading && !session ? (
          <p role="status">Connecting securely…</p>
        ) : session ? (
          <div className="auth-panel">
            <p>
              Signed in as <strong>{session.user.email}</strong>
            </p>
            <button type="button" onClick={signOut} disabled={loading}>
              Sign out
            </button>
          </div>
        ) : (
          <form className="auth-panel" onSubmit={sendMagicLink}>
            <label htmlFor="email">University email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
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

        {message && <p role="status" className="message">{message}</p>}
      </section>
    </main>
  )
}
