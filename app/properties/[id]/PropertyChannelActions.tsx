'use client'

import { useTransition } from 'react'
import { resolveComm, completeMaintJob } from './actions'

interface ResolveCommButtonProps {
  propertyId: string
  commId: string
}

export function ResolveCommButton({ propertyId, commId }: ResolveCommButtonProps) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(async () => { await resolveComm(propertyId, commId) })}
      disabled={isPending}
      className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Resolving…' : 'Mark resolved'}
    </button>
  )
}

interface CompleteMaintJobButtonProps {
  propertyId: string
  jobId: string
}

export function CompleteMaintJobButton({ propertyId, jobId }: CompleteMaintJobButtonProps) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(async () => { await completeMaintJob(propertyId, jobId) })}
      disabled={isPending}
      className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Completing…' : 'Mark complete'}
    </button>
  )
}
