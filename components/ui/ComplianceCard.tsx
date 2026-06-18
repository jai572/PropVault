import {
  getComplianceStatus,
  formatExpiryDate,
  daysUntilExpiry,
  type ComplianceStatus,
} from '@/lib/utils/compliance'

const statusConfig: Record<ComplianceStatus, { dot: string; bg: string; border: string; label: string; text: string }> = {
  expired: {
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Expired',
    text: 'text-red-700',
  },
  expiring_soon: {
    dot: 'bg-yellow-400',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    label: 'Expiring soon',
    text: 'text-yellow-700',
  },
  valid: {
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Valid',
    text: 'text-green-700',
  },
  not_set: {
    dot: 'bg-gray-300',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    label: 'Not recorded',
    text: 'text-gray-500',
  },
}

interface ComplianceCardProps {
  title: string
  expiry: string | null | undefined
}

export function ComplianceCard({ title, expiry }: ComplianceCardProps) {
  const status = getComplianceStatus(expiry)
  const config = statusConfig[status]
  const days = daysUntilExpiry(expiry)

  let subline: string | null = null
  if (status === 'expired' && days !== null) {
    subline = `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
  } else if (status === 'expiring_soon' && days !== null) {
    subline = `${days} day${days === 1 ? '' : 's'} remaining`
  }

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${config.dot}`} />
          <span className="text-sm font-medium text-gray-800">{title}</span>
        </div>
        <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
      </div>
      <div className="mt-3 pl-4">
        <p className="text-sm text-gray-700">{formatExpiryDate(expiry)}</p>
        {subline && (
          <p className={`text-xs mt-0.5 ${config.text}`}>{subline}</p>
        )}
      </div>
    </div>
  )
}
