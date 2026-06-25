'use client'

import { useActionState, useState } from 'react'
import { resolveDeposit, type ResolveDepositState } from './actions'
import Link from 'next/link'

interface Props {
  tenantId: string
  tenancyId: string
  tenancyReference: string
  depositAmount: number
  depositScheme: string | null
}

const initialState: ResolveDepositState = {}

function fmtMoney(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ResolveDepositForm({
  tenantId, tenancyId, tenancyReference, depositAmount, depositScheme,
}: Props) {
  const action = resolveDeposit.bind(null, tenantId, tenancyId)
  const [state, dispatch, pending] = useActionState(action, initialState)
  const [status, setStatus] = useState<string>('')

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Deposit resolved — {tenancyReference}</p>
        </div>
        <p className="text-sm text-green-700">The deposit outcome has been recorded.</p>
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

      <div className="mb-5 text-sm text-gray-600 space-y-1">
        <p>Deposit held: <strong>{fmtMoney(depositAmount)}</strong></p>
        {depositScheme && <p>Scheme: <strong>{depositScheme}</strong></p>}
      </div>

      <form action={dispatch} className="space-y-5">
        {/* Outcome */}
        <div>
          <label htmlFor="deposit_status" className="block text-sm font-medium text-gray-700 mb-1.5">
            Deposit outcome <span className="text-red-500">*</span>
          </label>
          <select
            id="deposit_status"
            name="deposit_status"
            required
            defaultValue=""
            onChange={e => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          >
            <option value="" disabled>Select outcome…</option>
            <option value="refunded">Refunded in full</option>
            <option value="retained">Retained (full deduction)</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>

        {/* Refund amount — shown for refunded (partial possible) or disputed */}
        {(status === 'refunded' || status === 'retained' || status === 'disputed') && (
          <div>
            <label htmlFor="deposit_refund_amount" className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount refunded to tenant (£){' '}
              <span className="text-gray-400 font-normal">
                {status === 'refunded' ? '(leave blank if full amount)' : '(optional)'}
              </span>
            </label>
            <input
              id="deposit_refund_amount"
              name="deposit_refund_amount"
              type="number"
              min="0"
              step="0.01"
              max={depositAmount}
              placeholder={status === 'refunded' ? String(depositAmount.toFixed(2)) : '0.00'}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="deposit_resolution_notes" className="block text-sm font-medium text-gray-700 mb-1.5">
            Notes / reason for deduction <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="deposit_resolution_notes"
            name="deposit_resolution_notes"
            rows={3}
            placeholder="e.g. £200 deducted for carpet cleaning, remainder refunded."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
        >
          {pending ? 'Saving…' : 'Record deposit outcome'}
        </button>
      </form>
    </div>
  )
}
