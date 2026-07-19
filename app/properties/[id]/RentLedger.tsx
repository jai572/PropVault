'use client'

import { useActionState, useState } from 'react'
import { markRentPaid, type MarkPaidState } from './rent-actions'

export type RentRecord = {
  id: string
  due_date: string
  amount_due: number
  amount_paid: number
  paid_date: string | null
  status: 'pending' | 'paid' | 'partial' | 'overdue'
  notes: string | null
}

const STATUS_STYLE: Record<RentRecord['status'], string> = {
  paid:    'bg-green-50  text-green-700',
  partial: 'bg-amber-50  text-amber-700',
  overdue: 'bg-red-50    text-red-700',
  pending: 'bg-gray-100  text-gray-500',
}

const STATUS_DOT: Record<RentRecord['status'], string> = {
  paid:    'bg-green-500',
  partial: 'bg-amber-400',
  overdue: 'bg-red-500',
  pending: 'bg-gray-300',
}

const STATUS_LABEL: Record<RentRecord['status'], string> = {
  paid:    'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  pending: 'Pending',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatGBP(n: number) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

function PayForm({ record, propertyId, onClose }: {
  record: RentRecord
  propertyId: string
  onClose: () => void
}) {
  const initial: MarkPaidState = {}
  const [state, dispatch, pending] = useActionState(markRentPaid, initial)

  return (
    <form action={dispatch} className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="record_id"   value={record.id} />
      <input type="hidden" name="property_id" value={propertyId} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount paid (£)</label>
          <input
            type="number"
            name="amount_paid"
            step="0.01"
            min="0"
            defaultValue={Number(record.amount_due).toFixed(2)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date paid</label>
          <input
            type="date"
            name="paid_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
        <input
          type="text"
          name="notes"
          defaultValue={record.notes ?? ''}
          placeholder="e.g. bank transfer ref"
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      {state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save payment'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function RentLedger({ records, propertyId }: {
  records: RentRecord[]
  propertyId: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (records.length === 0) {
    return <p className="text-sm text-gray-400">No rent records yet.</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Table header */}
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_120px_100px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due date</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount due</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount paid</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</span>
        <span />
      </div>

      <div className="divide-y divide-gray-100">
        {records.map((r) => (
          <div key={r.id} className="px-6 py-4">
            <div className="sm:grid sm:grid-cols-[1fr_1fr_1fr_120px_100px] sm:gap-4 sm:items-center space-y-1 sm:space-y-0">

              {/* Due date */}
              <div>
                <span className="text-xs text-gray-400 sm:hidden">Due </span>
                <span className="text-sm text-gray-900">{formatDate(r.due_date)}</span>
              </div>

              {/* Amount due */}
              <div>
                <span className="text-xs text-gray-400 sm:hidden">Due: </span>
                <span className="text-sm text-gray-900">{formatGBP(r.amount_due)}</span>
              </div>

              {/* Amount paid */}
              <div>
                <span className="text-xs text-gray-400 sm:hidden">Paid: </span>
                <span className={`text-sm ${r.amount_paid > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {r.amount_paid > 0 ? formatGBP(r.amount_paid) : '—'}
                </span>
              </div>

              {/* Status badge */}
              <div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[r.status]}`} />
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {/* Action */}
              <div>
                {r.status !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
                  >
                    {openId === r.id ? 'Cancel' : 'Mark as paid'}
                  </button>
                )}
                {r.status === 'paid' && r.paid_date && (
                  <span className="text-xs text-gray-400">
                    {formatDate(r.paid_date)}
                  </span>
                )}
              </div>
            </div>

            {/* Inline pay form */}
            {openId === r.id && (
              <PayForm
                record={r}
                propertyId={propertyId}
                onClose={() => setOpenId(null)}
              />
            )}

            {/* Notes */}
            {r.notes && openId !== r.id && (
              <p className="mt-1 text-xs text-gray-400 sm:pl-0">{r.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
