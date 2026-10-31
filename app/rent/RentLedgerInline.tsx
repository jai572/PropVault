'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { markRentPaidGlobal, type MarkPaidState } from './actions'

type RentRow = {
  id: string
  tenancy_id: string
  due_date: string
  amount_due: number
  amount_paid: number | null
  paid_date: string | null
  status: 'pending' | 'paid' | 'partial' | 'overdue'
  notes: string | null
  tenancy_reference: string
  property_address: string
  property_id: string
}

const STATUS_STYLE: Record<string, string> = {
  paid:    'bg-green-50 text-green-700',
  partial: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  pending: 'bg-gray-100 text-gray-500',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatGBP(n: number) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

function PayForm({ record, onClose }: { record: RentRow; onClose: () => void }) {
  const initial: MarkPaidState = {}
  const [state, dispatch, pending] = useActionState(markRentPaidGlobal, initial)

  return (
    <form action={dispatch} className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="record_id"   value={record.id} />
      <input type="hidden" name="property_id" value={record.property_id} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount paid (£)</label>
          <input
            type="number" name="amount_paid" step="0.01" min="0"
            defaultValue={record.amount_due.toFixed(2)} required
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date paid</label>
          <input
            type="date" name="paid_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
        <input
          type="text" name="notes" defaultValue={record.notes ?? ''} placeholder="e.g. bank transfer ref"
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {pending ? 'Saving…' : 'Save payment'}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
      </div>
    </form>
  )
}

export default function RentLedgerInline({ records }: { records: RentRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter)

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'overdue', 'pending', 'partial', 'paid'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_1fr_100px_80px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Property</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due date</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</span>
          <span />
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No records match this filter.</p>
          ) : (
            filtered.map(r => (
              <div key={r.id} className="px-5 py-4">
                <div className="sm:grid sm:grid-cols-[1.5fr_1fr_1fr_1fr_100px_80px] sm:gap-4 sm:items-center space-y-1 sm:space-y-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{r.property_address}</p>
                    <p className="text-xs text-gray-400">{r.tenancy_reference}</p>
                  </div>
                  <span className="text-sm text-gray-900">{formatDate(r.due_date)}</span>
                  <span className="text-sm text-gray-900">{formatGBP(r.amount_due)}</span>
                  <span className={`text-sm ${r.amount_paid && r.amount_paid > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {r.amount_paid && r.amount_paid > 0 ? formatGBP(r.amount_paid) : '—'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                  <div>
                    {r.status !== 'paid' ? (
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === r.id ? null : r.id)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
                      >
                        {openId === r.id ? 'Cancel' : 'Mark paid'}
                      </button>
                    ) : (
                      <Link
                        href={`/properties/${r.property_id}`}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
                {openId === r.id && (
                  <PayForm record={r} onClose={() => setOpenId(null)} />
                )}
                {r.notes && openId !== r.id && (
                  <p className="mt-1 text-xs text-gray-400">{r.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
