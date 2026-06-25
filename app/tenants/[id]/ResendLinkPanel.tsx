'use client'

import { useState, useTransition } from 'react'
import { resendOrRegenerateLink } from './actions'

interface Props {
  tenantId: string
  linkExpiresAt: string | null   // ISO string or null (pre-migration legacy row)
  createdAt: string              // ISO string — fallback for legacy expiry calc
}

const LINK_EXPIRY_MS = 72 * 60 * 60 * 1000

function resolveExpiry(linkExpiresAt: string | null, createdAt: string): Date {
  if (linkExpiresAt) return new Date(linkExpiresAt)
  return new Date(new Date(createdAt).getTime() + LINK_EXPIRY_MS)
}

function fmtExpiry(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ResendLinkPanel({ tenantId, linkExpiresAt, createdAt }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ linkUrl?: string; newExpiresAt?: string; error?: string }>({})
  const [copied, setCopied] = useState(false)

  // Use latest expiry from result if available (post-action), else initial prop
  const effectiveExpiry = result.newExpiresAt
    ? new Date(result.newExpiresAt)
    : resolveExpiry(linkExpiresAt, createdAt)

  const isExpired = Date.now() > effectiveExpiry.getTime()
  const buttonLabel = isPending ? 'Sending…' : isExpired ? 'Generate new link' : 'Resend link'

  function handleClick() {
    setResult({})
    setCopied(false)
    startTransition(async () => {
      const res = await resendOrRegenerateLink(tenantId)
      setResult(res)
    })
  }

  function copyLink() {
    if (!result.linkUrl) return
    navigator.clipboard.writeText(result.linkUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Tenant application link</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {isExpired
              ? 'This link has expired. Generate a new one to send to the tenant.'
              : <>Valid until <strong>{fmtExpiry(effectiveExpiry)}</strong>.</>}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {buttonLabel}
        </button>
      </div>

      {result.error && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      {result.linkUrl && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">
              {isExpired ? 'New link generated' : 'Link extended'} — expires {fmtExpiry(new Date(result.newExpiresAt!))}
            </p>
            <p className="text-sm text-gray-900 break-all font-mono">{result.linkUrl}</p>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="text-xs font-medium text-gray-700 rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-100 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  )
}
