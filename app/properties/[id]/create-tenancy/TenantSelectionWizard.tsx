'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TenantOption {
  id: string
  first_name: string
  last_name: string
  email: string
  status: 'prospective' | 'closed'
}

interface Props {
  propertyId: string
  availableTenants: TenantOption[]
}

export default function TenantSelectionWizard({ propertyId, availableTenants }: Props) {
  const router = useRouter()
  const [step, setStep]           = useState<1 | 2>(1)
  const [count, setCount]         = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([''])

  function handleCountSelect(n: number) {
    setCount(n)
    setSelectedIds(Array(n).fill(''))
    setStep(2)
  }

  function setSlot(index: number, value: string) {
    setSelectedIds(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function handleContinue() {
    const filled = selectedIds.slice(0, count).filter(Boolean)
    const [leadId, ...coIds] = filled
    if (!leadId) return
    const params = new URLSearchParams({ property_id: propertyId })
    if (coIds.length > 0) params.set('co_tenant_ids', coIds.join(','))
    router.push(`/tenants/${leadId}/create-tenancy?${params.toString()}`)
  }

  const allFilled = selectedIds.slice(0, count).every(id => id !== '')

  if (step === 1) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-600">How many tenants will this tenancy have?</p>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => handleCountSelect(n)}
              className="rounded-xl border border-gray-200 py-5 text-xl font-semibold text-gray-900 hover:border-gray-900 hover:bg-gray-50 transition-all"
            >
              {n}
            </button>
          ))}
        </div>
        {availableTenants.length === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            No prospective tenants with verified Right to Rent are available in this legal entity.
            Add and verify tenant records first.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => setStep(1)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> Back
      </button>

      <p className="text-sm text-gray-600">
        {count === 1
          ? 'Select the tenant for this tenancy.'
          : `Select all ${count} tenants. The first selection will be the lead tenant.`}
      </p>

      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => {
          const slotLabel = count === 1 ? 'Tenant' : i === 0 ? 'Lead tenant' : `Co-tenant ${i}`
          return (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{slotLabel}</label>
              <select
                value={selectedIds[i] ?? ''}
                onChange={e => setSlot(i, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
              >
                <option value="">Select tenant…</option>
                {availableTenants
                  .filter(t => !selectedIds.some((id, j) => j !== i && id === t.id))
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} — {t.email}{t.status === 'closed' ? ' (returning)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={!allFilled}
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Continue to tenancy details →
      </button>
    </div>
  )
}
