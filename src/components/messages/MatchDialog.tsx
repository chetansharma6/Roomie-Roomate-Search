import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

export function MatchDialog({ name, conversationId, onClose }: { name: string; conversationId: string; onClose: () => void }) {
  const primary = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    primary.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#152e26b3] p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="match-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-roomie-line bg-roomie-paper p-6 text-center text-roomie-ink shadow-xl">
        <h2 id="match-title" className="text-3xl font-extrabold">It's a match!</h2>
        <p className="mt-2 text-roomie-muted">You and {name} are interested in being roommates.</p>
        <div className="mt-6 grid gap-2">
          <Link ref={primary} className="button button-primary" to={`/messages/${conversationId}`} onClick={onClose}>Send a message</Link>
          <button className="button button-outline" type="button" onClick={onClose}>Keep browsing</button>
        </div>
      </div>
    </div>
  )
}
