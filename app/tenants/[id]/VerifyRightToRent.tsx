'use client'

import { useActionState } from 'react'
import { verifyRightToRent, type VerifyRightToRentState } from './actions'

const DOCUMENT_TYPES = [
  'UK/Irish Passport',
  'UK Biometric Residence Permit (BRP)',
  'EU Settlement Scheme – Share Code',
  'EEA National Identity Card',
  'Certificate of Registration / Naturalisation',
  'UK Driving Licence (with supporting document)',
  'Other',
]

const initialState: VerifyRightToRentState = {}

export default function VerifyRightToRent({ tenantId }: { tenantId: string }) {
  const boundAction = verifyRightToRent.bind(null, tenantId)
  const [state, action, pending] = useActionState(boundAction, initialState)

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Right to Rent verified and saved</p>
        </div>
        <p className="mt-1 text-sm text-green-700">Reload the page to see the updated record.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Mark as Verified</h2>

      {state.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="document_type" className="block text-sm font-medium text-gray-700 mb-1.5">
            Document type <span className="text-red-500">*</span>
          </label>
          <select
            id="document_type"
            name="document_type"
            required
            defaultValue=""
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          >
            <option value="" disabled>Select document type…</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="checked_date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Date checked <span className="text-red-500">*</span>
            </label>
            <input
              id="checked_date"
              name="checked_date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Document expiry <span className="text-gray-400 font-normal">(if applicable)</span>
            </label>
            <input
              id="expiry_date"
              name="expiry_date"
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
        >
          {pending ? 'Saving…' : 'Confirm verification'}
        </button>
      </form>
    </div>
  )
}
