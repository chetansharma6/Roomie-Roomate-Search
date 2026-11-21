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
    await expect(sendMagicLink('student@usf.edu')).rejects.toThrow('Too many sign-in requests')
    expect(authErrorMessage({ message: 'secret provider detail' })).not.toContain('secret')
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
