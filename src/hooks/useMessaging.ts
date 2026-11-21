import { useCallback, useEffect, useRef, useState } from 'react'
import { getInbox, getPeerProfiles, getUnreadCount, listMessages, markConversationRead, sendMessage, subscribeToMessages, type PeerProfile } from '../lib/messaging'
import { applyMessageToInbox, mergeMessages } from '../lib/messageState'
import type { InboxRow, MessageRow } from '../types/database'

const POLL_MS = 15_000

/** Polls only while Realtime is not connected: an explicit, labelled fallback. */
function usePollingFallback(connected: boolean, refresh: () => void) {
  useEffect(() => {
    if (connected) return
    const timer = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [connected, refresh])
}

export function useInbox(userId: string) {
  const [rows, setRows] = useState<InboxRow[]>([])
  const [peers, setPeers] = useState<ReadonlyMap<string, PeerProfile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const seen = useRef(new Set<string>())
  const peersRef = useRef(peers)

  const load = useCallback(async () => {
    try {
      const inbox = await getInbox()
      const missing = inbox.map((row) => row.other_user_id).filter((id) => !peersRef.current.has(id))
      if (missing.length) {
        const fetched = await getPeerProfiles(missing)
        peersRef.current = new Map([...peersRef.current, ...fetched.map((p) => [p.id, p] as const)])
        setPeers(peersRef.current)
      }
      setRows(inbox)
      setError('')
    } catch {
      setError('Could not load your conversations. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    let timer: number | undefined
    const refresh = () => { if (active) void load() }
    void load()
    const unsubscribe = subscribeToMessages({
      onMessage: (message, event) => {
        if (event === 'UPDATE') { window.clearTimeout(timer); timer = window.setTimeout(refresh, 250); return }
        let unknown = false
        setRows((current) => {
          const next = applyMessageToInbox(current, message, userId, seen.current)
          unknown = next === null
          return next ?? current
        })
        if (unknown) refresh() // first message of a brand-new match
      },
      onResync: refresh,
      onStatus: (ok) => { if (active) setConnected(ok) },
    }).catch(() => () => undefined)
    return () => { active = false; window.clearTimeout(timer); void unsubscribe.then((fn) => fn()) }
  }, [load, userId])

  usePollingFallback(connected, () => void load())
  return { rows, peers, loading, error, connected, reload: load }
}

export function useConversation(conversationId: string, userId: string) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const sendingRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const fetched = await listMessages(conversationId)
      setMessages((current) => mergeMessages(current, fetched))
      setError('')
      await markConversationRead(conversationId).catch(() => undefined)
    } catch {
      setError('Could not load this conversation. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; setState happens after await
    void load()
    const unsubscribe = subscribeToMessages({
      onMessage: (message, event) => {
        if (message.conversation_id !== conversationId) return
        setMessages((current) => mergeMessages(current, [message]))
        if (event === 'INSERT' && message.sender_id !== userId) void markConversationRead(conversationId).catch(() => undefined)
      },
      onResync: () => { if (active) void load() },
      onStatus: (ok) => { if (active) setConnected(ok) },
    }).catch(() => () => undefined)
    return () => { active = false; void unsubscribe.then((fn) => fn()) }
  }, [conversationId, userId, load])

  usePollingFallback(connected, () => void load())

  const send = useCallback(async (body: string): Promise<boolean> => {
    if (sendingRef.current) return false
    sendingRef.current = true
    setSending(true)
    setSendError('')
    try {
      const sent = await sendMessage(conversationId, body)
      setMessages((current) => mergeMessages(current, [sent]))
      return true
    } catch {
      setSendError('Message not sent. Check your connection and try again.')
      return false
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [conversationId])

  return { messages, loading, error, sendError, sending, connected, send, reload: load }
}

export function useUnreadCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const refresh = useCallback(async () => {
    try { setCount(await getUnreadCount()) } catch { /* badge is best-effort */ }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer: number | undefined
    const run = () => { if (active) void refresh() }
    run()
    const unsubscribe = subscribeToMessages({
      onMessage: () => { window.clearTimeout(timer); timer = window.setTimeout(run, 300) },
      onResync: run,
      onStatus: (ok) => { if (active) setConnected(ok) },
    }).catch(() => () => undefined)
    return () => { active = false; window.clearTimeout(timer); void unsubscribe.then((fn) => fn()) }
  }, [enabled, refresh])

  usePollingFallback(connected || !enabled, () => void refresh())
  return enabled ? count : 0
}

