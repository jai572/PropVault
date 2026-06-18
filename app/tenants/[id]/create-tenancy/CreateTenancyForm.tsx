'use client'

import { useActionState, useState } from 'react'
import { createTenancyAndGeneratePRT, createTenancyWithUpload, type CreateTenancyState } from './actions'
import Link from 'next/link'
import type { Property } from '@/types'

interface Props {
  tenantId: string
  tenantName: string
  tenantEmail: string
  internalUserId: string
  properties: Pick<Property, 'id' | 'address_line_1' | 'address_line_2' | 'city' | 'postcode' | 'is_hmo' | 'hmo_licence_number' | 'hmo_licence_expiry' | 'has_gas' | 'legal_entity_id'>[]
}

const initialState: CreateTenancyState = {}

const DEPOSIT_SCHEMES = [
  'SafeDeposits Scotland',
  'Letting Protection Service Scotland',
  'mydeposits Scotland',
]

const FURNISHED_OPTIONS = [
  'Furnished — see Inventory and Record of Condition',
  'Part-Furnished — see Inventory and Record of Condition',
  'Unfurnished',
]

export default function CreateTenancyForm({ tenantId, tenantName, tenantEmail, internalUserId, properties }: Props) {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate')

  const generateAction = createTenancyAndGeneratePRT.bind(null, tenantId, internalUserId)
  const uploadAction   = createTenancyWithUpload.bind(null, tenantId, internalUserId)

  const [genState,  genDispatch,  genPending]  = useActionState(generateAction, initialState)
  const [upState,   upDispatch,   upPending]   = useActionState(uploadAction,   initialState)

  const state   = mode === 'generate' ? genState  : upState
  const action  = mode === 'generate' ? genDispatch : upDispatch
  const pending = mode === 'generate' ? genPending  : upPending

  if (state.tenancyId && state.tenancyReference) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Tenancy created — {state.tenancyReference}</p>
        </div>
        <p className="text-sm text-green-700">
          {tenantName} has been moved to <strong>active</strong> status and a portal account invitation has been sent to their email.
          {mode === 'generate' ? ' The PRT has been generated and stored.' : ' The signed PRT has been uploaded and stored.'}
        </p>
        <Link href={`/tenants/${tenantId}`} className="inline-block text-sm text-green-700 underline hover:text-green-900">
          View tenant →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode('generate')}
          className={`flex-1 px-4 py-2.5 transition-colors ${mode === 'generate' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Generate new PRT
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 px-4 py-2.5 transition-colors border-l border-gray-200 ${mode === 'upload' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Upload existing signed PRT
        </button>
      </div>

      {mode === 'upload' && (
        <p className="text-xs text-gray-500 -mt-2">
          Use this to record a tenancy that already has a signed agreement — e.g. migrating an existing tenancy into PropVault.
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {state.error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-5">

          {/* ── Tenant details for PRT (generate mode only) ── */}
          {mode === 'generate' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-800">Tenant details for PRT</legend>
              <p className="text-xs text-gray-500 -mt-2">
                {tenantName} ({tenantEmail}) — additional details needed for the agreement.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tenant_dob" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date of birth <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="tenant_dob"
                    name="tenant_dob"
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="tenant_nationality" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nationality <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="tenant_nationality"
                    name="tenant_nationality"
                    type="text"
                    placeholder="e.g. British"
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tenant_passport" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Passport / ID document number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="tenant_passport"
                  name="tenant_passport"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label htmlFor="tenant_current_address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current address (pre-tenancy) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="tenant_current_address"
                  name="tenant_current_address"
                  type="text"
                  placeholder="e.g. 12 Example Street, Aberdeen, AB12 3CD"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </fieldset>
          )}

          {/* ── Property ── */}
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

          {/* ── Property description for PRT (generate mode only) ── */}
          {mode === 'generate' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-800">Property description for PRT</legend>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="property_type" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Property type <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="property_type"
                    name="property_type"
                    type="text"
                    placeholder="e.g. Flat (Third Floor Left)"
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="furnished_status" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Furnished status <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    id="furnished_status"
                    name="furnished_status"
                    defaultValue=""
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                  >
                    <option value="">Not specified</option>
                    {FURNISHED_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="shared_areas" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Shared areas <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="shared_areas"
                  name="shared_areas"
                  type="text"
                  placeholder="e.g. Common stair and entrance"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label htmlFor="excluded_areas" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Excluded areas <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="excluded_areas"
                  name="excluded_areas"
                  type="text"
                  placeholder="e.g. None"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label htmlFor="parking_description" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Parking <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="parking_description"
                  name="parking_description"
                  type="text"
                  placeholder="e.g. No parking is included with this tenancy"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </fieldset>
          )}

          {/* Room reference */}
          <div>
            <label htmlFor="room_reference" className="block text-sm font-medium text-gray-700 mb-1.5">
              Room / unit reference <span className="text-gray-400 font-normal">(optional — HMO rooms)</span>
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
                Rent due day (1–28) <span className="text-red-500">*</span>
              </label>
              <input
                id="rent_due_day"
                name="rent_due_day"
                type="number"
                min="1"
                max="28"
                required
                placeholder="e.g. 1"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deposit_amount" className="block text-sm font-medium text-gray-700 mb-1.5">
                Deposit (£) <span className="text-gray-400 font-normal">(optional)</span>
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
                {DEPOSIT_SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
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

          {/* Upload mode: existing signed PRT */}
          {mode === 'upload' && (
            <div>
              <label htmlFor="prt_file" className="block text-sm font-medium text-gray-700 mb-1.5">
                Signed PRT document (PDF) <span className="text-red-500">*</span>
              </label>
              <input
                id="prt_file"
                name="prt_file"
                type="file"
                accept="application/pdf"
                required
                className="w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-400">PDF only, max 20MB. This will be stored as the signed agreement for this tenancy.</p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            On submission: {tenantName} will be moved to <strong>active</strong> status and a portal account invitation will be sent to their email.
          </p>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            {pending
              ? (mode === 'generate' ? 'Generating PRT…' : 'Uploading…')
              : (mode === 'generate' ? 'Create tenancy and generate PRT' : 'Create tenancy and upload signed PRT')}
          </button>
        </form>
      </div>
    </div>
  )
}
