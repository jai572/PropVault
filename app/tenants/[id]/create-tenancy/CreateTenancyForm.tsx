'use client'

import { useActionState } from 'react'
import { createTenancy, type CreateTenancyState } from './actions'
import Link from 'next/link'
import type { Property } from '@/types'

interface Props {
  tenantId: string
  tenantName: string
  internalUserId: string
  properties: Pick<Property, 'id' | 'address_line_1' | 'address_line_2' | 'city' | 'postcode' | 'is_hmo' | 'hmo_licence_number' | 'hmo_licence_expiry' | 'has_gas' | 'legal_entity_id'>[]
}

const initialState: CreateTenancyState = {}

export default function CreateTenancyForm({ tenantId, tenantName, internalUserId, properties }: Props) {
  const boundAction = createTenancy.bind(null, tenantId, internalUserId)
  const [state, action, pending] = useActionState(boundAction, initialState)

  if (state.tenancyId && state.tenancyReference) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Tenancy created — {state.tenancyReference}</p>
        </div>
        <p className="text-sm text-green-700">
          {tenantName} has been moved to <strong>active</strong> status and a portal invitation has been sent to their email address.
          The PRT has been generated and stored.
        </p>
        <div className="flex gap-3 pt-1">
          <Link
            href={`/tenants/${tenantId}`}
            className="text-sm text-green-700 underline hover:text-green-900"
          >
            View tenant →
          </Link>
        </div>
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

      <form action={action} className="space-y-5">
        {/* Property */}
        <div>
          <label htmlFor="property_id" className="block text-sm font-medium text-gray-700 mb-1.5">
            Property <span className="text-red-500">*</span>
          </label>
          <select
            id="property_id"
            name="property_id"
            required
            defaultValue=""
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          >
            <option value="" disabled>Select property…</option>
            {properties.map((p) => {
              const addr = [p.address_line_1, p.address_line_2, p.city, p.postcode].filter(Boolean).join(', ')
              return <option key={p.id} value={p.id}>{addr}{p.is_hmo ? ' (HMO)' : ''}</option>
            })}
          </select>
        </div>

        {/* Room reference (for HMOs) */}
        <div>
          <label htmlFor="room_reference" className="block text-sm font-medium text-gray-700 mb-1.5">
            Room / unit reference <span className="text-gray-400 font-normal">(optional — for HMO rooms)</span>
          </label>
          <input
            id="room_reference"
            name="room_reference"
            type="text"
            placeholder="e.g. Room 2"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Start date */}
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Tenancy start date <span className="text-red-500">*</span>
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Rent */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="rent_amount" className="block text-sm font-medium text-gray-700 mb-1.5">
              Monthly rent (£) <span className="text-red-500">*</span>
            </label>
            <input
              id="rent_amount"
              name="rent_amount"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="rent_due_day" className="block text-sm font-medium text-gray-700 mb-1.5">
              Rent due day <span className="text-red-500">*</span>
            </label>
            <input
              id="rent_due_day"
              name="rent_due_day"
              type="number"
              min="1"
              max="28"
              required
              placeholder="1–28"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Deposit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="deposit_amount" className="block text-sm font-medium text-gray-700 mb-1.5">
              Deposit amount (£) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="deposit_amount"
              name="deposit_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="deposit_scheme" className="block text-sm font-medium text-gray-700 mb-1.5">
              Deposit scheme <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="deposit_scheme"
              name="deposit_scheme"
              defaultValue=""
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
            >
              <option value="">None / not yet</option>
              <option value="SafeDeposits Scotland">SafeDeposits Scotland</option>
              <option value="Letting Protection Service Scotland">Letting Protection Service Scotland</option>
              <option value="mydeposits Scotland">mydeposits Scotland</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="deposit_reference" className="block text-sm font-medium text-gray-700 mb-1.5">
            Deposit scheme reference <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="deposit_reference"
            name="deposit_reference"
            type="text"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <p className="text-xs text-gray-400">
          On submission: the PRT will be generated and stored, {tenantName} will be moved to <strong>active</strong> status, and a portal account invitation will be sent to their email.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
        >
          {pending ? 'Generating PRT…' : 'Create tenancy and generate PRT'}
        </button>
      </form>
    </div>
  )
}
