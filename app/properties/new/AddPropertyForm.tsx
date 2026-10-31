'use client'

import { useActionState, useState } from 'react'
import { addProperty, type AddPropertyState } from './actions'

interface LegalEntityOption {
  id: string
  name: string
  type: string
}

interface Props {
  legalEntities: LegalEntityOption[]
}

const STEPS = ['Address', 'Details', 'Entity', 'Compliance']

export default function AddPropertyForm({ legalEntities }: Props) {
  const [step, setStep] = useState(0)

  // Form field state
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity]                 = useState('')
  const [postcode, setPostcode]         = useState('')
  const [jurisdiction, setJurisdiction] = useState<'scotland' | 'england_wales' | ''>('')

  const [propertyType, setPropertyType] = useState('')
  const [bedrooms, setBedrooms]         = useState('')
  const [isHmo, setIsHmo]               = useState(false)
  const [hasGas, setHasGas]             = useState(false)
  const [hmoLicenceNumber, setHmoLicenceNumber] = useState('')
  const [hmoLicenceExpiry, setHmoLicenceExpiry] = useState('')

  const [legalEntityId, setLegalEntityId] = useState('')

  const [epcExpiry, setEpcExpiry]             = useState('')
  const [eicrExpiry, setEicrExpiry]           = useState('')
  const [gasSafetyExpiry, setGasSafetyExpiry] = useState('')

  const [stepError, setStepError] = useState<string | null>(null)

  const initial: AddPropertyState = {}
  const [state, dispatch, pending] = useActionState(addProperty, initial)

  // Auto-detect jurisdiction from postcode
  const SCOTLAND_RE = /^(AB|DD|DG|EH|FK|G\d|HS|IV|KA|KW|KY|ML|PA|PH|TD|ZE)/i
  function inferJurisdiction(pc: string): 'scotland' | 'england_wales' | '' {
    if (!pc.trim()) return ''
    return SCOTLAND_RE.test(pc.trim()) ? 'scotland' : 'england_wales'
  }

  function handlePostcodeBlur(pc: string) {
    if (!jurisdiction) {
      const inferred = inferJurisdiction(pc)
      if (inferred) setJurisdiction(inferred)
    }
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!addressLine1.trim()) return 'Address line 1 is required.'
      if (!city.trim()) return 'City / town is required.'
      if (!postcode.trim()) return 'Postcode is required.'
      if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postcode.trim())) return 'Please enter a valid UK postcode.'
    }
    if (step === 2) {
      if (!legalEntityId) return 'Please select a legal entity.'
    }
    return null
  }

  function goNext() {
    const err = validateStep()
    if (err) { setStepError(err); return }
    setStepError(null)
    setStep(s => s + 1)
  }

  function goBack() {
    setStepError(null)
    setStep(s => s - 1)
  }

  const fieldClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 placeholder-gray-400'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  const displayJurisdiction = jurisdiction || inferJurisdiction(postcode)

  return (
    <div className="space-y-6">
      {/* Step progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              i < step ? 'bg-gray-900 text-white' : i === step ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-xs ${i === step ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="text-gray-200 mx-1">›</span>}
          </div>
        ))}
      </div>

      {(stepError || state.error) && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {stepError ?? state.error}
        </p>
      )}

      <form action={dispatch}>
        {/* Hidden fields always submitted */}
        <input type="hidden" name="address_line_1"   value={addressLine1} />
        <input type="hidden" name="address_line_2"   value={addressLine2} />
        <input type="hidden" name="city"             value={city} />
        <input type="hidden" name="postcode"         value={postcode} />
        <input type="hidden" name="jurisdiction"     value={displayJurisdiction} />
        <input type="hidden" name="property_type"    value={propertyType} />
        <input type="hidden" name="bedrooms"         value={bedrooms} />
        <input type="hidden" name="is_hmo"           value={String(isHmo)} />
        <input type="hidden" name="has_gas"          value={String(hasGas)} />
        <input type="hidden" name="hmo_licence_number" value={hmoLicenceNumber} />
        <input type="hidden" name="hmo_licence_expiry" value={hmoLicenceExpiry} />
        <input type="hidden" name="legal_entity_id"  value={legalEntityId} />
        <input type="hidden" name="epc_expiry"       value={epcExpiry} />
        <input type="hidden" name="eicr_expiry"      value={eicrExpiry} />
        <input type="hidden" name="gas_safety_expiry" value={gasSafetyExpiry} />

        {/* ── Step 0: Address ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Address line 1 *</label>
              <input className={fieldClass} type="text" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="12 Victoria Terrace" autoFocus />
            </div>
            <div>
              <label className={labelClass}>Address line 2</label>
              <input className={fieldClass} type="text" value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder="Flat 2 (optional)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>City / town *</label>
                <input className={fieldClass} type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Edinburgh" />
              </div>
              <div>
                <label className={labelClass}>Postcode *</label>
                <input
                  className={fieldClass}
                  type="text"
                  value={postcode}
                  onChange={e => setPostcode(e.target.value.toUpperCase())}
                  onBlur={e => handlePostcodeBlur(e.target.value)}
                  placeholder="EH1 1AB"
                  maxLength={8}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Jurisdiction</label>
              <select className={fieldClass} value={displayJurisdiction} onChange={e => setJurisdiction(e.target.value as 'scotland' | 'england_wales')}>
                <option value="">Auto-detect from postcode</option>
                <option value="scotland">Scotland (PRT)</option>
                <option value="england_wales">England / Wales (APT)</option>
              </select>
              {displayJurisdiction && (
                <p className="mt-1 text-xs text-gray-500">
                  {displayJurisdiction === 'scotland' ? '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Private Residential Tenancy rules apply' : '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Assured Periodic Tenancy / Renters Rights Act 2025'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Property type</label>
              <select className={fieldClass} value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                <option value="">Select type…</option>
                <option value="flat">Flat</option>
                <option value="house">House</option>
                <option value="studio">Studio</option>
                <option value="bungalow">Bungalow</option>
                <option value="terraced">Terraced</option>
                <option value="semi-detached">Semi-detached</option>
                <option value="detached">Detached</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Bedrooms</label>
              <input className={fieldClass} type="number" min="0" max="99" value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="e.g. 2" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isHmo} onChange={e => setIsHmo(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                <span className="text-sm text-gray-700">HMO (House in Multiple Occupation)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hasGas} onChange={e => setHasGas(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                <span className="text-sm text-gray-700">Has gas supply</span>
              </label>
            </div>
            {isHmo && (
              <div className="space-y-3 rounded-lg bg-purple-50 border border-purple-200 p-4">
                <div>
                  <label className={labelClass}>HMO licence number</label>
                  <input className={fieldClass} type="text" value={hmoLicenceNumber} onChange={e => setHmoLicenceNumber(e.target.value)} placeholder="e.g. HMO/2024/12345" />
                </div>
                <div>
                  <label className={labelClass}>HMO licence expiry</label>
                  <input className={fieldClass} type="date" value={hmoLicenceExpiry} onChange={e => setHmoLicenceExpiry(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Entity ── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Which legal entity owns this property?</p>
            {legalEntities.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                No legal entities found. Please contact your account administrator.
              </p>
            ) : (
              <div className="space-y-2">
                {legalEntities.map(e => (
                  <label key={e.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${legalEntityId === e.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="entity_select"
                      value={e.id}
                      checked={legalEntityId === e.id}
                      onChange={() => setLegalEntityId(e.id)}
                      className="h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{e.type}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Compliance ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Enter current certificate expiry dates. You can skip these and update them later from the property page.</p>
            <div>
              <label className={labelClass}>EPC expiry date</label>
              <input className={fieldClass} type="date" value={epcExpiry} onChange={e => setEpcExpiry(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>EICR expiry date</label>
              <input className={fieldClass} type="date" value={eicrExpiry} onChange={e => setEicrExpiry(e.target.value)} />
            </div>
            {hasGas && (
              <div>
                <label className={labelClass}>Gas Safety Certificate expiry date</label>
                <input className={fieldClass} type="date" value={gasSafetyExpiry} onChange={e => setGasSafetyExpiry(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={goBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              ← Back
            </button>
          ) : <span />}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Saving…' : 'Save property'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
