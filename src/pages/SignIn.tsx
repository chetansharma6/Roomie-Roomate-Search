import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import Discover from './Discover'

interface RoommateInsightsResponse {
  insight: string
}

export default function SignIn() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDiscover, setShowDiscover] = useState(false)
  const [profile, setProfile] = useState('')
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

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
      options: { emailRedirectTo: new URL('/signup', window.location.origin).href },
    })

    setMessage(error ? error.message : 'Check your email for the secure sign-in link.')
    setLoading(false)
  }

  async function signOut() {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    setInsight('')
    setProfile('')
    setMessage(error?.message ?? '')
    setLoading(false)
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

        {loading && !session ? (
          <p role="status">Connecting securely…</p>
        ) : session ? (
          <div className="member-area">
            <div className="session-bar">
              <p>
                Signed in as <strong>{session.user.email}</strong>
              </p>
              <button className="secondary" type="button" onClick={signOut} disabled={loading}>
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

        {message && <p role="alert" className="message">{message}</p>}
      </section>
    </main>
  )
}
