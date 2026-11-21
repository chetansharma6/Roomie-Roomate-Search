import { ArrowLeft } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConversation } from '../../hooks/useMessaging'
import { dayLabel, MAX_MESSAGE_LENGTH, timeLabel, validateMessageBody } from '../../lib/messageState'
import type { PeerProfile } from '../../lib/messaging'
import { Avatar } from './Avatar'

export function ChatView({ conversationId, userId, peer, peerName }: {
  conversationId: string; userId: string; peer?: PeerProfile; peerName: string
}) {
  const { messages, loading, error, sendError, sending, connected, send, reload } = useConversation(conversationId, userId)
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages])
  useEffect(() => { stick.current = true }, [conversationId])

  async function submit() {
    if (sending || !validateMessageBody(draft)) return
    stick.current = true
    if (await send(draft)) setDraft('')
  }

  const canSend = !sending && validateMessageBody(draft) !== null
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Conversation with ${peerName}`}>
      <header className="flex items-center gap-3 border-b border-roomie-line bg-white px-3 py-3 sm:px-4">
        <Link to="/inbox" className="icon-button lg:hidden!" aria-label="Back to inbox"><ArrowLeft size={19} aria-hidden="true" /></Link>
        <Avatar name={peerName} photoUrl={peer?.photo_url} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-extrabold">{peerName}</h2>
          {peer?.major && <p className="truncate text-xs text-roomie-muted">{peer.major}</p>}
        </div>
      </header>
      {!connected && <p className="bg-roomie-peach/50 px-4 py-1.5 text-xs text-roomie-ink" role="status">Live updates unavailable; refreshing every 15 seconds.</p>}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-roomie-paper px-3 py-4 sm:px-5"
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {loading && <p className="text-center text-sm text-roomie-muted" role="status">Loading messages…</p>}
        {error && <div role="alert" className="text-center text-sm text-rose-700">{error} <button className="underline" type="button" onClick={() => void reload()}>Retry</button></div>}
        {!loading && !error && messages.length === 0 && <p className="mt-8 text-center text-roomie-muted">You matched with {peerName}! Say hello to start the conversation.</p>}
        <ol className="flex flex-col gap-1.5">
          {messages.map((message, index) => {
            const mine = message.sender_id === userId
            const day = dayLabel(message.created_at)
            const showDay = index === 0 || dayLabel(messages[index - 1].created_at) !== day
            return (
              <li key={message.id} className="flex flex-col">
                {showDay && <p className="my-3 text-center text-xs font-semibold text-roomie-muted">{day}</p>}
                <div className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
                  {/* Rendered as a React text node: never interpreted as HTML. */}
                  <p className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[.95rem] ${mine ? 'rounded-br-sm bg-roomie-teal text-white' : 'rounded-bl-sm border border-roomie-line bg-white'}`}>{message.body}</p>
                  <time className={`mt-0.5 block text-[.7rem] text-roomie-muted ${mine ? 'text-right' : ''}`} dateTime={message.created_at}>
                    {timeLabel(message.created_at)}{mine && message.read_at ? ' · Read' : ''}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <form className="border-t border-roomie-line bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => { e.preventDefault(); void submit() }}>
        {sendError && <p className="mb-2 text-sm text-rose-700" role="alert">{sendError}</p>}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="message-input">Message {peerName}</label>
          <textarea id="message-input" rows={1} value={draft} maxLength={MAX_MESSAGE_LENGTH} disabled={sending}
            placeholder="Write a message…" enterKeyHint="send"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-roomie-line bg-white px-3 py-2.5 text-base disabled:opacity-60"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }} />
          <button className="button button-primary" type="submit" disabled={!canSend}>{sending ? 'Sending…' : 'Send'}</button>
        </div>
        {draft.length > MAX_MESSAGE_LENGTH - 200 && <p className="mt-1 text-right text-xs text-roomie-muted">{draft.length}/{MAX_MESSAGE_LENGTH}</p>}
      </form>
    </section>
  )
}
