'use client'

import { useTransition, useState } from 'react'
import { cancelTenant, archiveTenant } from './actions'

interface TenantActionsProps {
  tenantId: string
  tenantName: string
  hasDocuments: boolean
}

export default function TenantActions({ tenantId, tenantName, hasDocuments }: TenantActionsProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    if (!window.confirm(`Cancel ${tenantName}? This will permanently delete the tenant record. This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await cancelTenant(tenantId)
      if (result.error) setError(result.error)
    })
  }

  function handleArchive() {
    if (!window.confirm(`Archive ${tenantName}? Their documents will be retained but their application link will be invalidated.`)) return
    setError(null)
    startTransition(async () => {
      const result = await archiveTenant(tenantId)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        {hasDocuments ? (
          <button
            onClick={handleArchive}
            disabled={pending}
            className="text-xs font-medium text-amber-600 hover:text-amber-800 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Archiving…' : 'Archive'}
          </button>
        ) : (
          <button
            onClick={handleCancel}
            disabled={pending}
            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}
