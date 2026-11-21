import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { z } from 'zod'
import { isAllowedEmailDomain, parseAllowedEmailDomains } from './emailDomains'
import { captureOtpResponse } from './otpRetry'
import type { AuthDestination } from '../types/auth'

// Loading the client on demand lets the landing/demo pages work without config.
export async function getAuthClient() {
  return (await import('./supabase')).supabase
}

export const supportedUniversityDomains = parseAllowedEmailDomains(import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS)

export const missingAuthSettings = [
  !import.meta.env.VITE_SUPABASE_URL?.trim() && 'VITE_SUPABASE_URL',
  !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  !supportedUniversityDomains.length && 'VITE_ALLOWED_EMAIL_DOMAINS',
].filter((setting): setting is string => Boolean(setting))

export class RoomieAuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'RoomieAuthError'
  }
}

export class MagicLinkRateLimitError extends RoomieAuthError {
  constructor(public readonly retryAt?: number) {
    super('rate_limited', 'Try again shortly')
    this.name = 'MagicLinkRateLimitError'
  }
}

function isRateLimited(status?: number, code?: string) {
  return status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit'
}

export function isSupportedUniversityEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return z.email().safeParse(normalized).success && isAllowedEmailDomain(normalized, supportedUniversityDomains)
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof RoomieAuthError) return error.message
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (isRateLimited(status, code)) return 'Try again shortly'
  if (code === 'otp_expired' || code === 'flow_state_expired') return 'This sign-in link has expired or was already used. Request a new link.'
  if (code === 'email_address_not_authorized') return 'Email delivery is restricted. Ask the Roomie team to configure custom SMTP.'
  if (code === 'email_not_confirmed') return 'Confirm your email using the sign-in link before continuing.'
  return 'Authentication is unavailable right now. Please try again.'
}

export async function sendMagicLink(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!z.email().safeParse(normalized).success) throw new RoomieAuthError('invalid_email', 'Enter a valid email address.')
  if (!supportedUniversityDomains.length) throw new RoomieAuthError('not_configured', 'University sign-in is not configured. Contact the Roomie team.')
  if (!isSupportedUniversityEmail(normalized)) throw new RoomieAuthError('unsupported_domain', 'Use an email address from a supported university.')
  const client = await getAuthClient()
  const { result: { error }, status, retryAt } = await captureOtpResponse(normalized, () => client.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: new URL('/signup', window.location.origin).href },
  }))
  if (isRateLimited(status ?? error?.status, error?.code)) {
    // Supabase also includes a remaining delay in its email cooldown error.
    const seconds = error?.message.match(/^For security purposes, you can only request this after (\d+) seconds?\.$/)?.[1]
    const messageDeadline = seconds === undefined ? undefined : Date.now() + Number(seconds) * 1000
    throw new MagicLinkRateLimitError(retryAt ?? (Number.isFinite(messageDeadline) ? messageDeadline : undefined))
  }
  if (error) throw new RoomieAuthError(error.code ?? 'send_failed', authErrorMessage(error))
}

export async function getSession(): Promise<Session | null> {
  const client = await getAuthClient()
  const { data, error } = await client.auth.getSession()
  if (error) throw new RoomieAuthError('session_failed', authErrorMessage(error))
  if (data.session?.expires_at && data.session.expires_at * 1000 <= Date.now()) {
    throw new RoomieAuthError('expired_session', 'Your session expired. Request a new sign-in link.')
  }
  return data.session
}

export async function getCurrentUser() {
  if (!(await getSession())) return null
  const client = await getAuthClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new RoomieAuthError('invalid_session', 'Your session is invalid. Please sign in again.')
  if (!data.user.email_confirmed_at) throw new RoomieAuthError('email_not_confirmed', 'Confirm your university email before continuing.')
  if (!data.user.email || !isSupportedUniversityEmail(data.user.email)) {
    throw new RoomieAuthError('unsupported_domain', 'Your email domain is not supported by Roomie.')
  }
  return data.user
}

export async function getAuthDestination(userId: string): Promise<AuthDestination> {
  const client = await getAuthClient()
  const { data, error } = await client.from('profiles').select('move_in_date').eq('id', userId).maybeSingle()
  if (error) throw new RoomieAuthError('profile_lookup_failed', 'Could not check your profile. Please retry.')
  return data?.move_in_date ? '/discover' : '/onboarding'
}

export async function signOut(): Promise<void> {
  const client = await getAuthClient()
  const { error } = await client.auth.signOut()
  if (error) throw new RoomieAuthError('signout_failed', 'Could not sign out. Please try again.')
}

export async function subscribeToAuth(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const client = await getAuthClient()
  const { data } = client.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}

/** Only fixed messages are displayed; provider errors can include sensitive URL data. */
export function consumeAuthCallbackError(): string | null {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const code = url.searchParams.get('error_code') ?? hash.get('error_code')
  if (!code && !url.searchParams.has('error') && !hash.has('error')) return null
  for (const field of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(field)
    hash.delete(field)
  }
  url.hash = hash.toString()
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  return code === 'otp_expired'
    ? 'This sign-in link has expired or was already used. Request a new link.'
    : 'The sign-in link could not be confirmed. Request a new link.'
}
