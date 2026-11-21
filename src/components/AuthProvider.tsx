import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthContext } from '../hooks/useAuth'
import { authErrorMessage, consumeAuthCallbackError, getAuthDestination, getCurrentUser, getSession, missingAuthSettings, sendMagicLink, signOut, subscribeToAuth } from '../lib/auth'
import type { AuthState } from '../types/auth'

const signedOut: AuthState = { session: null, user: null, destination: null, loading: false, error: null }
const authConfigured = missingAuthSettings.length === 0

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(authConfigured ? { ...signedOut, loading: true } : signedOut)
  const revision = useRef(0)
  const callbackError = useRef<string | null | undefined>(undefined)
  const refresh = useCallback(async () => {
    const current = ++revision.current
    setState((previous) => ({ ...previous, loading: true, error: null }))
    try {
      const session = await getSession()
      const user = session ? await getCurrentUser() : null
      const destination = user ? await getAuthDestination(user.id) : null
      if (current === revision.current) setState({ session, user, destination, loading: false, error: null })
    } catch (error) {
      if (current === revision.current) setState({ ...signedOut, error: authErrorMessage(error) })
    }
  }, [])
  const invalidateRevision = useCallback(() => {
    revision.current += 1
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!authConfigured) return
    // Keep the message across effect replays after removing the provider's error from the URL.
    if (callbackError.current === undefined) callbackError.current = consumeAuthCallbackError()
    const initialError = callbackError.current
    void subscribeToAuth((event) => {
      if (!active) return
      if (event === 'INITIAL_SESSION') return // Explicit restoration below handles this once.
      ++revision.current
      clearTimeout(timer)
      if (event === 'SIGNED_OUT') {
        setState(signedOut)
      } else {
        // Keep SDK calls outside onAuthStateChange to avoid its internal lock.
        timer = setTimeout(() => { if (active) void refresh() }, 0)
      }
    }).then((stop) => { if (active) unsubscribe = stop; else stop() })
      .catch((error: unknown) => { if (active) setState({ ...signedOut, error: authErrorMessage(error) }) })
    if (initialError) {
      queueMicrotask(() => {
        if (active) setState({ ...signedOut, error: initialError })
      })
    } else {
      timer = setTimeout(() => { if (active) void refresh() }, 0)
    }
    return () => { active = false; invalidateRevision(); clearTimeout(timer); unsubscribe?.() }
  }, [invalidateRevision, refresh])

  const logout = useCallback(async () => {
    await signOut()
    ++revision.current
    setState(signedOut)
  }, [])

  return <AuthContext.Provider value={{ ...state, refresh, sendMagicLink, signOut: logout }}>{children}</AuthContext.Provider>
}
