import { describe, expect, it } from 'vitest'
import {
  getEmailDomain,
  isAllowedEmailDomain,
  parseAllowedEmailDomains,
} from '../src/lib/emailDomains.js'

describe('university email domain allowlist', () => {
  it('normalizes and de-duplicates configured domains', () => {
    expect(parseAllowedEmailDomains(' USF.edu,example.edu,usf.edu ')).toEqual([
      'usf.edu',
      'example.edu',
    ])
  })

  it('extracts a normalized domain from an email address', () => {
    expect(getEmailDomain(' Student@USF.EDU ')).toBe('usf.edu')
    expect(getEmailDomain('not-an-email')).toBeNull()
    expect(getEmailDomain('@usf.edu')).toBeNull()
  })

  it('allows only exact configured domains', () => {
    const domains = ['usf.edu']
    expect(isAllowedEmailDomain('student@usf.edu', domains)).toBe(true)
    expect(isAllowedEmailDomain('student@mail.usf.edu', domains)).toBe(false)
    expect(isAllowedEmailDomain('student@other.edu', domains)).toBe(false)
  })

  it('fails closed when no domains are configured', () => {
    expect(isAllowedEmailDomain('student@usf.edu', [])).toBe(false)
  })
})
