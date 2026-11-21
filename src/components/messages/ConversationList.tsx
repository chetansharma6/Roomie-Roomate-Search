import { Link } from 'react-router-dom'
import { inboxTimeLabel, peerName, previewText } from '../../lib/messageState'
import type { PeerProfile } from '../../lib/messaging'
import type { InboxRow } from '../../types/database'
import { Avatar } from './Avatar'

export function ConversationList({ rows, peers, activeId, userId, loading, error, onRetry }: {
  rows: InboxRow[]; peers: ReadonlyMap<string, PeerProfile>; activeId?: string; userId: string
  loading: boolean; error: string; onRetry: () => void
}) {
  if (loading) return <p className="p-6 text-sm text-roomie-muted" role="status">Loading conversations…</p>
  if (error && rows.length === 0) return <div className="p-6" role="alert"><p className="text-sm text-rose-700">{error}</p><button className="button button-outline mt-3" type="button" onClick={onRetry}>Retry</button></div>
  if (rows.length === 0) return (
    <div className="grid justify-items-center gap-4 p-8 text-center">
      <p className="max-w-xs text-roomie-muted">You don't have any matches yet. Start discovering roommates to connect with someone!</p>
      <Link className="button button-primary" to="/discover">Discover roommates</Link>
    </div>
  )
  return (
    <ul aria-label="Conversations" className="divide-y divide-roomie-line">
      {rows.map((row) => {
        const name = peerName(peers, row.other_user_id)
        const unread = row.unread_count > 0
        const preview = row.last_message_body === null ? 'You matched! Say hello.'
          : `${row.last_message_sender_id === userId ? 'You: ' : ''}${previewText(row.last_message_body)}`
        return (
          <li key={row.conversation_id}>
            <Link to={`/messages/${row.conversation_id}`} aria-current={row.conversation_id === activeId ? 'page' : undefined}
              className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-roomie-mint/60 ${row.conversation_id === activeId ? 'bg-roomie-mint' : ''}`}>
              <Avatar name={name} photoUrl={peers.get(row.other_user_id)?.photo_url} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${unread ? 'font-extrabold' : 'font-semibold'}`}>{name}</span>
                  <time className="shrink-0 text-xs text-roomie-muted" dateTime={row.last_message_at}>{inboxTimeLabel(row.last_message_at)}</time>
                </span>
                <span className={`block truncate text-sm ${unread ? 'font-semibold text-roomie-ink' : 'text-roomie-muted'}`}>{preview}</span>
              </span>
              {unread && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-roomie-teal px-1.5 text-xs font-bold text-white"
                aria-label={`${row.unread_count} unread`}>{row.unread_count > 99 ? '99+' : row.unread_count}</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
