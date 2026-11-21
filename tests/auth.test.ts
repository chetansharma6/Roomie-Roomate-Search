import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  vi.stubEnv('VITE_ALLOWED_EMAIL_DOMAINS', 'usf.edu')
  return {
  signInWithOtp: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  }
})
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: mocks,
  from: mocks.from,
} }))
import { captureOtpResponse, fetchWithOtpRetry } from '../src/lib/otpRetry'
import { authErrorMessage, consumeAuthCallbackError, getAuthDestination, getCurrentUser, getSession, isSupportedUniversityEmail, sendMagicLink, signOut } from '../src/lib/auth'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', href: 'http://localhost:5173/signup' }, history: { replaceState: vi.fn() } })
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.signInWithOtp.mockResolvedValue({ error: null })
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
})

describe('Roomie auth service', () => {
  it.each([
    'http://localhost:5173',
    'https://roomie-example-5173.app.github.dev',
  ])('normalizes a university email and uses the browser origin %s for the signup callback', async (origin) => {
    vi.stubGlobal('window', { location: { origin } })
    await sendMagicLink(' Student@USF.EDU ')
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'student@usf.edu',
      options: { emailRedirectTo: `${origin}/signup` },
    })
  })
  it.each(['bad-address', 'a@@usf.edu', 'a@usf.edu.evil.com', 'a@gmail.com', 'a@other.edu'])('rejects %s before contacting Supabase', async (email) => {
    expect(isSupportedUniversityEmail(email)).toBe(false)
    await expect(sendMagicLink(email)).rejects.toThrow()
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
  })
  it('returns a safe rate-limit message without provider details', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 429, message: 'secret provider detail' } })
    await expect(sendMagicLink('student@usf.edu')).rejects.toMatchObject({
      code: 'rate_limited', message: 'Try again shortly', retryAt: undefined,
    })
    expect(authErrorMessage({ message: 'secret provider detail' })).not.toContain('secret')
  })
  it('uses the remaining delay in Supabase’s email cooldown response', async () => {
    const now = Date.now()
    mocks.signInWithOtp.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 30 seconds.' },
    })
    const result = await sendMagicLink('student@usf.edu').catch((error) => error)
    expect(result.code).toBe('rate_limited')
    expect(result.retryAt).toBeGreaterThanOrEqual(now + 30_000)
    expect(result.retryAt).toBeLessThanOrEqual(Date.now() + 30_000)
  })
  it.each(['30', 'Wed, 21 Oct 2030 07:28:00 GMT'])('captures the Retry-After header (%s) before SDK parsing', async (header) => {
    const now = new Date('2030-10-21T07:27:30Z')
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 429, headers: { 'Retry-After': header },
    }))
    try {
      const email = 'student@usf.edu'
      const result = await captureOtpResponse(email, () => fetchWithOtpRetry('https://auth.example/auth/v1/otp', {
        method: 'POST', body: JSON.stringify({ email }),
      }))
      expect(result.status).toBe(429)
      expect(result.retryAt).toBe(now.getTime() + 30_000)
    } finally {
      vi.mocked(Date.now).mockRestore()
      fetchMock.mockRestore()
    }
  })
  it('handles missing sessions without calling getUser', async () => {
    expect(await getSession()).toBeNull()
    expect(await getCurrentUser()).toBeNull()
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it('rejects an expired session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { expires_at: 1 } }, error: null })
    await expect(getSession()).rejects.toThrow('expired')
  })
  it('restores identity from Supabase Auth only after email confirmation', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { expires_at: Date.now() / 1000 + 3600 } }, error: null })
    const user = { id: 'student-a', email: 'student@usf.edu', email_confirmed_at: '2026-11-21T00:00:00Z' }
    mocks.getUser.mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user: { ...user, email_confirmed_at: null } }, error: null })
    expect(await getCurrentUser()).toEqual(user)
    await expect(getCurrentUser()).rejects.toThrow('Confirm your university email')
  })
  it('routes new and existing profiles, and never treats a query error as a missing profile', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { move_in_date: null }, error: null })
      .mockResolvedValueOnce({ data: { move_in_date: '2027-01-05' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    expect(await getAuthDestination('student-a')).toBe('/onboarding')
    expect(await getAuthDestination('student-a')).toBe('/onboarding')
    expect(await getAuthDestination('student-a')).toBe('/discover')
    await expect(getAuthDestination('student-a')).rejects.toThrow('Could not check your profile')
    expect(mocks.eq).toHaveBeenCalledWith('id', 'student-a')
  })
  it('removes callback error parameters and displays a fixed expired-link message', () => {
    window.location.href = 'http://localhost:5173/signup#error=access_denied&error_code=otp_expired&error_description=private-detail'
    expect(consumeAuthCallbackError()).toContain('expired')
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/signup')
  })
  it('supports sign out and reports failures without provider messages', async () => {
    mocks.signOut.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'private-detail' } })
    await signOut()
    await expect(signOut()).rejects.toThrow('Could not sign out')
  })
})
