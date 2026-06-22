'use client'

import { useActionState, useRef } from 'react'
import { addFacility, removeFacility, type FacilityState } from './actions'
import type { PropertyFacility } from '@/types'

interface Props {
  propertyId: string
  facilities: PropertyFacility[]
}

const TYPE_LABELS: Record<PropertyFacility['type'], string> = {
  included: 'Included',
  shared: 'Shared',
  excluded: 'Excluded',
}

const TYPE_COLOURS: Record<PropertyFacility['type'], string> = {
  included: 'bg-green-50 text-green-700 ring-green-200',
  shared:   'bg-blue-50 text-blue-700 ring-blue-200',
  excluded: 'bg-gray-50 text-gray-600 ring-gray-200',
}

const initialState: FacilityState = {}

export default function PropertyFacilitiesPanel({ propertyId, facilities }: Props) {
  const addAction = addFacility.bind(null, propertyId)
  const [state, dispatch, pending] = useActionState(addAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Reset form on successful add
  const handleSubmit = (formData: FormData) => {
    dispatch(formData)
    // form resets via key — handled by revalidation re-render
  }

  const grouped = {
    included: facilities.filter(f => f.type === 'included'),
    shared:   facilities.filter(f => f.type === 'shared'),
    excluded: facilities.filter(f => f.type === 'excluded'),
  }

  return (
    <div className="space-y-4">
      {/* Current facilities */}
      {facilities.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No facilities recorded. Add them below — they will appear in every PRT generated for this property.</p>
      ) : (
        <div className="space-y-3">
          {(['included', 'shared', 'excluded'] as const).map(type => {
            const items = grouped[type]
            if (items.length === 0) return null
            return (
              <div key={type}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{TYPE_LABELS[type]}</p>
                <ul className="space-y-1.5">
                  {items.map(f => (
                    <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset flex-shrink-0 ${TYPE_COLOURS[f.type]}`}>
                          {TYPE_LABELS[f.type]}
                        </span>
                        <span className="text-sm text-gray-900 truncate">{f.facility_name}</span>
                      </div>
                      <form
                        action={async () => {
                          await removeFacility(propertyId, f.id)
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                          aria-label={`Remove ${f.facility_name}`}
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {/* Add facility form */}
      <form ref={formRef} action={handleSubmit} className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <input
            name="facility_name"
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Common stair, Parking space, Loft storage…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div>
          <select
            name="facility_type"
            defaultValue="included"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="included">Included</option>
            <option value="shared">Shared</option>
            <option value="excluded">Excluded</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <p className="text-xs text-gray-400">
        These facilities are automatically applied to every PRT generated for this property — Section 5 (Included / Shared / Excluded areas).
      </p>
    </div>
  )
}
