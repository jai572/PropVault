'use client'

import { useActionState, useState } from 'react'
import { closeTenancy, type CloseTenancyState } from './actions'
import Link from 'next/link'

interface Props {
  tenantId: string
  tenantName: string
  tenancyId: string
  tenancyReference: string
  propertyId: string
  propertyAddress: string
  todayISO: string
}

const initialState: CloseTenancyState = {}

const REASONS = [
  { value: 'tenant_notice',    label: 'Tenant gave notice' },
  { value: 'landlord_notice',  label: 'Landlord gave notice' },
  { value: 'mutual_agreement', label: 'Mutual agreement' },
  { value: 'other',            label: 'Other' },
] as const

export default function CloseTenancyForm({
  tenantId, tenantName, tenancyId, tenancyReference, propertyId, propertyAddress, todayISO,
}: Props) {
  const action = closeTenancy.bind(null, tenantId, tenancyId, propertyId)
  const [state, dispatch, pending] = useActionState(action, initialState)
  const [reason, setReason] = useState<string>('')

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Tenancy closed — {tenancyReference}</p>
        </div>
        <p className="text-sm text-green-700">
          The tenancy at {propertyAddress} has been marked as closed and the property status updated.
          If a deposit was held, you can now resolve it from the tenant&rsquo;s detail page.
        </p>
        <Link href={`/tenants/${tenantId}`} className="inline-block text-sm text-green-700 underline hover:text-green-900">
          View tenant →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {state.error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={dispatch} className="space-y-5">
        {/* End date */}
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Tenancy end date <span className="text-red-500">*</span>
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            defaultValue={todayISO}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="closure_reason" className="block text-sm font-medium text-gray-700 mb-1.5">
            Reason for ending tenancy <span className="text-red-500">*</span>
          </label>
          <select
            id="closure_reason"
            name="closure_reason"
            required
            defaultValue=""
            onChange={e => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          >
            <option value="" disabled>Select reason…</option>
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Other reason — revealed when 'Other' selected */}
        {reason === 'other' && (
          <div>
            <label htmlFor="closure_reason_other" className="block text-sm font-medium text-gray-700 mb-1.5">
              Please describe <span className="text-red-500">*</span>
            </label>
            <input
              id="closure_reason_other"
              name="closure_reason_other"
              type="text"
              required
              autoFocus
              placeholder="Briefly describe the reason"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="closure_notes" className="block text-sm font-medium text-gray-700 mb-1.5">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="closure_notes"
            name="closure_notes"
            rows={3}
            placeholder="e.g. Notice served 1 June, tenant vacated on agreed date."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
          />
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          This will mark {tenantName}&rsquo;s tenancy at {propertyAddress} as closed and set the
          property back to available. Deposit resolution is handled separately afterwards.
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
        >
          {pending ? 'Closing tenancy…' : 'Close tenancy'}
        </button>
      </form>
    </div>
  )
}
