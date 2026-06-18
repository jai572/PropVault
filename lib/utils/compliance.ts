export type ComplianceStatus = 'expired' | 'expiring_soon' | 'valid' | 'not_set'

const EXPIRY_WARNING_DAYS = 90

export function getComplianceStatus(expiry: string | null | undefined): ComplianceStatus {
  if (!expiry) return 'not_set'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiryDate = new Date(expiry)
  const daysRemaining = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= EXPIRY_WARNING_DAYS) return 'expiring_soon'
  return 'valid'
}

export function formatExpiryDate(expiry: string | null | undefined): string {
  if (!expiry) return 'Not recorded'
  return new Date(expiry).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function daysUntilExpiry(expiry: string | null | undefined): number | null {
  if (!expiry) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((new Date(expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
