import { Navigate, useParams } from 'react-router-dom'
import { ChatView } from '../components/messages/ChatView'
import { ConversationList } from '../components/messages/ConversationList'
import { useAuth } from '../hooks/useAuth'
import { useInbox } from '../hooks/useMessaging'
import { peerName } from '../lib/messageState'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** /inbox and /messages/:conversationId share one two-column layout; mobile shows one pane at a time. */
export function MessagesPage() {
  const { user, loading, destination } = useAuth()
  if (loading && !user) return <main className="shell route-notice" id="main-content" role="status">Restoring session…</main>
  if (!user) return <Navigate to="/signup" replace />
  if (destination === '/onboarding') return <Navigate to="/onboarding" replace />
  return <MessagesLayout userId={user.id} />
}

function MessagesLayout({ userId }: { userId: string }) {
  const { conversationId } = useParams()
  const { rows, peers, loading, error, reload } = useInbox(userId)
  const active = conversationId && UUID.test(conversationId) ? rows.find((row) => row.conversation_id === conversationId) : undefined
  const missing = Boolean(conversationId) && !loading && !active

  return (
    <main id="main-content" className="shell py-4 sm:py-6">
      <div className="grid h-[calc(100dvh-9.5rem)] min-h-[28rem] overflow-hidden rounded-2xl border border-roomie-line bg-white lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside aria-label="Inbox" className={`min-h-0 flex-col overflow-y-auto border-roomie-line lg:flex lg:border-r ${conversationId ? 'hidden' : 'flex'}`}>
          <h1 className="border-b border-roomie-line px-4 py-3 text-xl font-extrabold">Inbox</h1>
          <ConversationList rows={rows} peers={peers} activeId={active?.conversation_id} userId={userId}
            loading={loading} error={error} onRetry={() => void reload()} />
        </aside>
        <div className={`min-h-0 min-w-0 lg:block ${conversationId ? 'block' : 'hidden'}`}>
          {active ? (
            <ChatView key={active.conversation_id} conversationId={active.conversation_id} userId={userId}
              peer={peers.get(active.other_user_id)} peerName={peerName(peers, active.other_user_id)} />
          ) : missing ? (
            <div className="grid h-full place-items-center p-6 text-center"><p role="alert">This conversation isn't available.</p></div>
          ) : (
            <div className="hidden h-full place-items-center p-6 text-center text-roomie-muted lg:grid">
              {conversationId ? <p role="status">Loading…</p> : <p>Select a conversation to start messaging.</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
