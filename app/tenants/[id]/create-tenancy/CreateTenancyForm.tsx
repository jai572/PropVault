'use client'

import { useActionState, useState, useRef } from 'react'
import { createTenancyAndGeneratePRT, createTenancyWithUpload, type CreateTenancyState } from './actions'
import Link from 'next/link'
import type { Property } from '@/types'
import type { CoTenantOption } from './page'

interface Props {
  tenantId: string
  tenantName: string
  tenantEmail: string
  internalUserId: string
  properties: Pick<Property, 'id' | 'address_line_1' | 'address_line_2' | 'city' | 'postcode' | 'is_hmo' | 'hmo_licence_number' | 'hmo_licence_expiry' | 'has_gas' | 'legal_entity_id'>[]
  availableCoTenants: CoTenantOption[]
  defaultPropertyId?: string
  defaultCoTenantIds?: string[]
  showEntityName?: boolean
  entityTypes?: Record<string, 'individual' | 'company'>
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

function isoToDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CreateTenancyForm({
  tenantId, tenantName, tenantEmail, internalUserId, properties, availableCoTenants,
  defaultPropertyId, defaultCoTenantIds, showEntityName, entityTypes = {},
}: Props) {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(defaultPropertyId ?? '')
  const [depositAmountVal, setDepositAmountVal] = useState('')
  const [showDepositConfirm, setShowDepositConfirm] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // When arriving from the property wizard, co-tenants are already finalised
  const lockedCoTenants = defaultCoTenantIds && defaultCoTenantIds.length > 0
    ? availableCoTenants.filter(ct => defaultCoTenantIds.includes(ct.id))
    : null

  const [selectedCoTenantIds, setSelectedCoTenantIds] = useState<string[]>(defaultCoTenantIds ?? [])

  // Names used in the submission notice — resolved from locked list or free selection
  const coTenantNames = lockedCoTenants
    ? lockedCoTenants.map(ct => `${ct.first_name} ${ct.last_name}`)
    : selectedCoTenantIds
        .map(sid => availableCoTenants.find(ct => ct.id === sid))
        .filter((ct): ct is typeof availableCoTenants[number] => ct !== undefined)
        .map(ct => `${ct.first_name} ${ct.last_name}`)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)
  const isCompanyEntity = selectedProperty
    ? (entityTypes[selectedProperty.legal_entity_id] === 'company')
    : false

  const depositIsEntered = parseFloat(depositAmountVal) > 0

  const generateAction = createTenancyAndGeneratePRT.bind(null, tenantId, internalUserId)
  const uploadAction   = createTenancyWithUpload.bind(null, tenantId, internalUserId)

  const [genState,  genDispatch,  genPending]  = useActionState(generateAction, initialState)
  const [upState,   upDispatch,   upPending]   = useActionState(uploadAction,   initialState)

  const state   = mode === 'generate' ? genState  : upState
  const action  = mode === 'generate' ? genDispatch : upDispatch
  const pending = mode === 'generate' ? genPending  : upPending

  function toggleCoTenant(id: string) {
    setSelectedCoTenantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (mode === 'upload') {
      upDispatch(fd)
      return
    }
    // Generate mode: check deposit
    const raw = (fd.get('deposit_amount') as string ?? '').trim()
    const val = parseFloat(raw)
    if (!raw || isNaN(val) || val === 0) {
      setPendingFormData(fd)
      setShowDepositConfirm(true)
      return
    }
    genDispatch(fd)
  }

  function confirmNoDeposit() {
    setShowDepositConfirm(false)
    if (pendingFormData) {
      genDispatch(pendingFormData)
      setPendingFormData(null)
    }
  }

  if (state.tenancyId && state.tenancyReference) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Tenancy created — {state.tenancyReference}</p>
        </div>
        <p className="text-sm text-green-700">
          {tenantName}{selectedCoTenantIds.length > 0 ? ' and all joint tenants have' : ' has'} been moved to{' '}
          <strong>active</strong> status and portal account invitations have been sent.
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
      {/* ── No-deposit confirmation dialog ── */}
      {showDepositConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">No deposit amount entered</h2>
            <p className="text-sm text-gray-600">
              You have entered no deposit amount. If this tenancy has no deposit, click{' '}
              <strong>Confirm</strong> to continue. If you meant to enter a deposit amount, click{' '}
              <strong>Cancel</strong> to return to the form.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={confirmNoDeposit}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
              >
                Confirm — no deposit
              </button>
              <button
                type="button"
                onClick={() => { setShowDepositConfirm(false); setPendingFormData(null) }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
        <button type="button" onClick={() => setMode('generate')}
          className={`flex-1 px-4 py-2.5 transition-colors ${mode === 'generate' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Generate new PRT
        </button>
        <button type="button" onClick={() => setMode('upload')}
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

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

          {/* ── Lead tenant details for PRT (generate mode only) ── */}
          {mode === 'generate' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-800">Lead tenant details</legend>
              <p className="text-xs text-gray-500 -mt-2">
                {tenantName} ({tenantEmail}) — additional details for the PRT.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tenant_dob" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date of birth <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input id="tenant_dob" name="tenant_dob" type="date"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="tenant_nationality" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nationality <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input id="tenant_nationality" name="tenant_nationality" type="text"
                    placeholder="e.g. British" autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="tenant_passport" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Passport / ID number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input id="tenant_passport" name="tenant_passport" type="text" autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <div>
                <label htmlFor="tenant_current_address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current address (pre-tenancy) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input id="tenant_current_address" name="tenant_current_address" type="text"
                  placeholder="e.g. 12 Example Street, Aberdeen, AB12 3CD" autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </fieldset>
          )}

          {/* ── Joint tenants ── */}
          {lockedCoTenants ? (
            /* Locked mode: co-tenants were chosen in the property wizard — display only */
            <fieldset className="space-y-3">
              <div>
                <legend className="text-sm font-semibold text-gray-800">Joint tenants</legend>
                <p className="text-xs text-gray-500 mt-0.5">
                  Selected in the previous step. Tenant composition is fixed for this tenancy.
                </p>
              </div>

              <div className="space-y-2">
                {lockedCoTenants.map(ct => (
                  <div key={ct.id} className="space-y-3">
                    {/* Hidden input so the action receives the co-tenant id */}
                    <input type="hidden" name="co_tenant_id" value={ct.id} />

                    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="mt-0.5 h-4 w-4 rounded border border-gray-300 bg-gray-200 flex-shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{ct.first_name} {ct.last_name}</p>
                        <p className="text-xs text-gray-500">
                          {ct.email}
                          {showEntityName && ct.legal_entity_name && (
                            <span className="ml-1.5 text-gray-400">· {ct.legal_entity_name}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Per co-tenant PRT details — generate mode only */}
                    {mode === 'generate' && (
                      <div className="ml-7 space-y-3 border-l-2 border-gray-200 pl-4">
                        <p className="text-xs font-medium text-gray-600">
                          Details for {ct.first_name} {ct.last_name}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor={`co_dob_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Date of birth
                            </label>
                            <input
                              id={`co_dob_${ct.id}`}
                              name={`co_dob_${ct.id}`}
                              type="date"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                            />
                          </div>
                          <div>
                            <label htmlFor={`co_nationality_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Nationality
                            </label>
                            <input
                              id={`co_nationality_${ct.id}`}
                              name={`co_nationality_${ct.id}`}
                              type="text"
                              placeholder="e.g. British"
                              autoComplete="off"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`co_passport_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                            Passport / ID number
                          </label>
                          <input
                            id={`co_passport_${ct.id}`}
                            name={`co_passport_${ct.id}`}
                            type="text"
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                        </div>
                        <div>
                          <label htmlFor={`co_address_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                            Current address (pre-tenancy)
                          </label>
                          <input
                            id={`co_address_${ct.id}`}
                            name={`co_address_${ct.id}`}
                            type="text"
                            placeholder="e.g. 12 Example Street, Aberdeen, AB12 3CD"
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          ) : availableCoTenants.length > 0 ? (
            /* Free-selection mode: arrived directly at the tenant create-tenancy page */
            <fieldset className="space-y-3">
              <div>
                <legend className="text-sm font-semibold text-gray-800">Joint tenants</legend>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select any co-tenants for this joint tenancy. Only verified prospective tenants are listed.
                </p>
              </div>

              <div className="space-y-2">
                {availableCoTenants.map(ct => {
                  const isSelected = selectedCoTenantIds.includes(ct.id)
                  return (
                    <div key={ct.id} className="space-y-3">
                      <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="checkbox"
                          name="co_tenant_id"
                          value={ct.id}
                          checked={isSelected}
                          onChange={() => toggleCoTenant(ct.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{ct.first_name} {ct.last_name}</p>
                          <p className="text-xs text-gray-500">
                            {ct.email}
                            {showEntityName && ct.legal_entity_name && (
                              <span className="ml-1.5 text-gray-400">· {ct.legal_entity_name}</span>
                            )}
                          </p>
                        </div>
                      </label>

                      {isSelected && mode === 'generate' && (
                        <div className="ml-7 space-y-3 border-l-2 border-gray-200 pl-4">
                          <p className="text-xs font-medium text-gray-600">
                            Details for {ct.first_name} {ct.last_name}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label htmlFor={`co_dob_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                Date of birth
                              </label>
                              <input
                                id={`co_dob_${ct.id}`}
                                name={`co_dob_${ct.id}`}
                                type="date"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                              />
                            </div>
                            <div>
                              <label htmlFor={`co_nationality_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                Nationality
                              </label>
                              <input
                                id={`co_nationality_${ct.id}`}
                                name={`co_nationality_${ct.id}`}
                                type="text"
                                placeholder="e.g. British"
                                autoComplete="off"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`co_passport_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Passport / ID number
                            </label>
                            <input
                              id={`co_passport_${ct.id}`}
                              name={`co_passport_${ct.id}`}
                              type="text"
                              autoComplete="off"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                            />
                          </div>
                          <div>
                            <label htmlFor={`co_address_${ct.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Current address (pre-tenancy)
                            </label>
                            <input
                              id={`co_address_${ct.id}`}
                              name={`co_address_${ct.id}`}
                              type="text"
                              placeholder="e.g. 12 Example Street, Aberdeen, AB12 3CD"
                              autoComplete="off"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          {/* ── Property ── */}
          <div>
            <label htmlFor="property_id" className="block text-sm font-medium text-gray-700 mb-1.5">
              Property <span className="text-red-500">*</span>
            </label>
            <select id="property_id" name="property_id" required value={selectedPropertyId}
              onChange={e => setSelectedPropertyId(e.target.value)}
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
              <p className="text-xs text-gray-500 -mt-2">
                Included / shared / excluded facilities are inherited from the property record.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="property_type" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Property type <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input id="property_type" name="property_type" type="text"
                    placeholder="e.g. Flat (Third Floor Left)" autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="furnished_status" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Furnished status <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select id="furnished_status" name="furnished_status" defaultValue=""
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                  >
                    <option value="">Not specified</option>
                    {FURNISHED_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>
          )}

          {/* ── Company signatory (generate mode, company entity only) ── */}
          {mode === 'generate' && isCompanyEntity && (
            <fieldset className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <legend className="text-sm font-semibold text-gray-800 px-1">Landlord signatory</legend>
              <p className="text-xs text-gray-600 -mt-2">
                This property belongs to a company. Enter the details of the person signing on behalf of the company.
                The signature block will read: <span className="font-medium">[Full Name], [Capacity], for and on behalf of [Company Name]</span>.
              </p>
              <div>
                <label htmlFor="signatory_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Authorised signatory full name <span className="text-red-500">*</span>
                </label>
                <input id="signatory_name" name="signatory_name" type="text" required autoComplete="off"
                  placeholder="e.g. Jai Bhalani"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <div>
                <label htmlFor="signatory_capacity" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Capacity <span className="text-red-500">*</span>
                </label>
                <input id="signatory_capacity" name="signatory_capacity" type="text" required autoComplete="off"
                  placeholder="e.g. Director, Company Secretary, Authorised Officer"
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
            <input id="room_reference" name="room_reference" type="text"
              placeholder="e.g. Room 2" autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Start date */}
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Tenancy start date <span className="text-red-500">*</span>
            </label>
            <input id="start_date" name="start_date" type="date" required
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Rent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rent_amount" className="block text-sm font-medium text-gray-700 mb-1.5">
                Monthly rent (£) <span className="text-red-500">*</span>
              </label>
              <input id="rent_amount" name="rent_amount" type="number" min="1" step="0.01" required
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="rent_due_day" className="block text-sm font-medium text-gray-700 mb-1.5">
                Rent due day (1–28) <span className="text-red-500">*</span>
              </label>
              <input id="rent_due_day" name="rent_due_day" type="number" min="1" max="28" required
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
              <input id="deposit_amount" name="deposit_amount" type="number" min="0" step="0.01"
                placeholder="0.00"
                value={depositAmountVal}
                onChange={e => setDepositAmountVal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="deposit_scheme" className="block text-sm font-medium text-gray-700 mb-1.5">
                Deposit scheme{' '}
                {depositIsEntered
                  ? <span className="text-red-500">*</span>
                  : <span className="text-gray-400 font-normal">(optional)</span>
                }
              </label>
              <select id="deposit_scheme" name="deposit_scheme" defaultValue="mydeposits Scotland"
                required={depositIsEntered}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
              >
                <option value="">None / not yet</option>
                {DEPOSIT_SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {depositIsEntered && (
                <p className="mt-1 text-xs text-gray-500">Required when a deposit amount is entered.</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="deposit_reference" className="block text-sm font-medium text-gray-700 mb-1.5">
              Deposit scheme reference <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input id="deposit_reference" name="deposit_reference" type="text" autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Upload mode: existing signed PRT */}
          {mode === 'upload' && (
            <div>
              <label htmlFor="prt_file" className="block text-sm font-medium text-gray-700 mb-1.5">
                Signed PRT document (PDF) <span className="text-red-500">*</span>
              </label>
              <input id="prt_file" name="prt_file" type="file" accept="application/pdf" required
                className="w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-400">PDF only, max 20MB.</p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            On submission: {[tenantName, ...coTenantNames].join(', ')} will be moved
            to <strong>active</strong> status and portal account invitations will be sent.
          </p>

          <button type="submit" disabled={pending}
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
