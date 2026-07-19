'use client'

import { useActionState, useState } from 'react'
import { endTenancy, type EndTenancyState } from './end-tenancy-action'

export default function EndTenancyButton({
  tenancyId,
  propertyId,
  tenancyReference,
}: {
  tenancyId: string
  propertyId: string
  tenancyReference: string
}) {
  const [confirming, setConfirming] = useState(false)
  const initial: EndTenancyState = {}
  const [state, dispatch, pending] = useActionState(endTenancy, initial)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-600 hover:text-red-800 underline underline-offset-2 transition-colors"
      >
        End tenancy
      </button>
    )
  }

  return (
    <form action={dispatch} className="flex flex-col items-end gap-2">
      <input type="hidden" name="tenancy_id"   value={tenancyId} />
      <input type="hidden" name="property_id"  value={propertyId} />

      <p className="text-xs text-gray-600 text-right max-w-xs">
        End <span className="font-medium">{tenancyReference}</span>? This sets the tenancy to
        closed and the property back to available. This cannot be undone.
      </p>

      {state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Ending…' : 'Confirm end tenancy'}
        </button>
      </div>
    </form>
  )
}
