import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyRoommateRequests, respondToRoommateRequest } from '../../lib/roommateRequests'
import type { RoommateRequestRow } from '../../types/database'
import type { RoommateProfile } from '../../types/profile'

type IncomingRequest = { request: RoommateRequestRow; senderName: string }

export function RoommateRequestInbox({ profiles }: { profiles: RoommateProfile[] }) {
  const [requests, setRequests] = useState<IncomingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<{ id: string; status: 'accepted' | 'declined' } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void (async () => {
      const { received } = await getMyRoommateRequests()
      const pending = received.filter((request) => request.status === 'pending')
      const names = new Map(profiles.map((profile) => [profile.id, profile.displayName]))
      const incoming = pending.map((request) => ({ request, senderName: names.get(request.sender_id) ?? 'A student' }))
      if (active) setRequests(incoming)
    })().catch(() => {
      if (active) setError('Could not load roommate requests. Please retry.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [profiles, attempt])

  async function respond(requestId: string, status: 'accepted' | 'declined') {
    if (responding) return
    setResponding({ id: requestId, status })
    setError('')
    setNotice('')
    setAccepted(false)
    try {
      await respondToRoommateRequest(requestId, status)
      setRequests((current) => current.filter(({ request }) => request.id !== requestId))
      setNotice(status === 'accepted' ? 'It’s a match! Roommate request accepted.' : 'Roommate request declined.')
      setAccepted(status === 'accepted')
    } catch {
      setError('Could not update this request. It may have already been answered; refresh and try again.')
    } finally {
      setResponding(null)
    }
  }

  if (loading) return <p className="mx-auto max-w-6xl px-4 py-2 text-sm text-slate-500 sm:px-6" role="status">Loading roommate requests…</p>
  if (requests.length === 0 && !error && !notice) return null

  return (
    <section className="mx-auto my-4 max-w-6xl px-4 sm:px-6" aria-labelledby="incoming-requests-title">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="incoming-requests-title" className="text-base font-semibold text-slate-900">Incoming roommate requests</h2>
        {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error} <button className="underline" type="button" onClick={() => { setLoading(true); setError(''); setAttempt((current) => current + 1) }}>Retry</button></p>}
        {notice && <p className="mt-2 text-sm text-emerald-700" role="status">{notice}{accepted && <> <Link className="font-semibold underline" to="/inbox">Send a message</Link></>}</p>}
        {requests.length > 0 && <ul className="mt-3 divide-y divide-slate-100">
          {requests.map(({ request, senderName }) => <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="text-sm text-slate-700">{senderName} is interested in connecting.</p>
            <div className="flex gap-2">
              <button className="button button-primary" type="button" disabled={Boolean(responding)} onClick={() => void respond(request.id, 'accepted')}>
                {responding?.id === request.id && responding.status === 'accepted' ? 'Saving…' : 'Accept'}
              </button>
              <button className="button button-outline" type="button" disabled={Boolean(responding)} onClick={() => void respond(request.id, 'declined')}>
                {responding?.id === request.id && responding.status === 'declined' ? 'Saving…' : 'Decline'}
              </button>
            </div>
          </li>)}
        </ul>}
      </div>
    </section>
  )
}
