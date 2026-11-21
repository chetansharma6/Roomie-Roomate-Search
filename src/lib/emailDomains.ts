export function parseAllowedEmailDomains(value: string | undefined): string[] {
  return [...new Set(
    (value ?? '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  )]
}

export function getEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  const separator = normalized.lastIndexOf('@')

  if (separator <= 0 || separator === normalized.length - 1) {
    return null
  }

  return normalized.slice(separator + 1)
}

export function isAllowedEmailDomain(email: string, allowedDomains: string[]): boolean {
  const domain = getEmailDomain(email)
  return domain !== null && allowedDomains.includes(domain)
}
