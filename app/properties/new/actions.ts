'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sanitiseText } from '@/lib/utils/sanitise'

export interface AddPropertyState {
  error?: string
  propertyId?: string
}

const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function optionalDate(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (!DATE_RE.test(v)) return 'INVALID'
  return v
}

export async function addProperty(
  _prev: AddPropertyState,
  formData: FormData
): Promise<AddPropertyState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Step 1: Address ───────────────────────────────────────────────────────
  const addressLine1 = sanitiseText(formData.get('address_line_1') as string ?? '')
  const addressLine2 = sanitiseText(formData.get('address_line_2') as string ?? '') || null
  const city         = sanitiseText(formData.get('city')           as string ?? '')
  const postcode     = sanitiseText(formData.get('postcode')       as string ?? '').toUpperCase()

  if (!addressLine1) return { error: 'Address line 1 is required.' }
  if (!city)         return { error: 'City / town is required.' }
  if (!postcode)     return { error: 'Postcode is required.' }
  if (!POSTCODE_RE.test(postcode)) return { error: 'Please enter a valid UK postcode.' }

  // Infer jurisdiction from postcode: Scottish postcodes start with AB, DD, DG, EH, FK, G, HS, IV, KA, KW, KY, ML, PA, PH, TD, ZE
  const SCOTLAND_PREFIXES = /^(AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|TD|ZE)/i
  const jurisdictionRaw = formData.get('jurisdiction') as string ?? ''
  const jurisdiction = (jurisdictionRaw === 'scotland' || jurisdictionRaw === 'england_wales')
    ? jurisdictionRaw
    : SCOTLAND_PREFIXES.test(postcode) ? 'scotland' : 'england_wales'

  // ── Step 2: Property details ───────────────────────────────────────────────
  const propertyType  = sanitiseText(formData.get('property_type') as string ?? '') || null
  const bedroomsRaw   = sanitiseText(formData.get('bedrooms')      as string ?? '')
  const isHmoRaw      = formData.get('is_hmo')
  const hasGasRaw     = formData.get('has_gas')

  const bedrooms = bedroomsRaw ? parseInt(bedroomsRaw, 10) : null
  if (bedrooms !== null && (isNaN(bedrooms) || bedrooms < 0 || bedrooms > 99)) {
    return { error: 'Invalid number of bedrooms.' }
  }
  const isHmo  = isHmoRaw  === 'true' || isHmoRaw  === '1'
  const hasGas = hasGasRaw === 'true' || hasGasRaw === '1'

  const hmoLicenceNumber = isHmo ? sanitiseText(formData.get('hmo_licence_number') as string ?? '') || null : null
  const hmoLicenceExpiryRaw = isHmo ? sanitiseText(formData.get('hmo_licence_expiry') as string ?? '') : ''
  const hmoLicenceExpiry = isHmo ? optionalDate(hmoLicenceExpiryRaw) : null
  if (hmoLicenceExpiry === 'INVALID') return { error: 'Invalid HMO licence expiry date.' }

  // ── Step 3: Legal entity ──────────────────────────────────────────────────
  const legalEntityId = sanitiseText(formData.get('legal_entity_id') as string ?? '')
  if (!legalEntityId) return { error: 'Please select a legal entity.' }

  // Verify this entity belongs to the current user
  const { data: internalUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  if (!internalUser) redirect('/login')

  const { data: entityLink } = await supabase
    .from('user_legal_entities')
    .select('legal_entity_id')
    .eq('user_id', internalUser.id)
    .eq('legal_entity_id', legalEntityId)
    .maybeSingle()

  const { data: internalUserFull } = await supabase.from('users').select('role').eq('id', internalUser.id).single()
  const isSuperAdmin = internalUserFull?.role === 'super_admin'

  if (!entityLink && !isSuperAdmin) {
    return { error: 'You do not have permission to add properties to this entity.' }
  }

  // ── Step 4: Compliance ────────────────────────────────────────────────────
  const epcExpiryRaw         = sanitiseText(formData.get('epc_expiry')         as string ?? '')
  const eicrExpiryRaw        = sanitiseText(formData.get('eicr_expiry')        as string ?? '')
  const gasSafetyExpiryRaw   = hasGas ? sanitiseText(formData.get('gas_safety_expiry') as string ?? '') : ''

  const epcExpiry       = optionalDate(epcExpiryRaw)
  const eicrExpiry      = optionalDate(eicrExpiryRaw)
  const gasSafetyExpiry = hasGas ? optionalDate(gasSafetyExpiryRaw) : null

  if (epcExpiry       === 'INVALID') return { error: 'Invalid EPC expiry date.' }
  if (eicrExpiry      === 'INVALID') return { error: 'Invalid EICR expiry date.' }
  if (gasSafetyExpiry === 'INVALID') return { error: 'Invalid gas safety certificate expiry date.' }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data: property, error: insertError } = await supabase
    .from('properties')
    .insert({
      address_line_1:     addressLine1,
      address_line_2:     addressLine2,
      city,
      postcode,
      property_type:      propertyType,
      bedrooms,
      is_hmo:             isHmo,
      hmo_licence_number: hmoLicenceNumber,
      hmo_licence_expiry: hmoLicenceExpiry,
      has_gas:            hasGas,
      status:             'available',
      legal_entity_id:    legalEntityId,
      jurisdiction,
      epc_expiry:         epcExpiry,
      eicr_expiry:        eicrExpiry,
      gas_safety_expiry:  gasSafetyExpiry,
    })
    .select('id')
    .single()

  if (insertError || !property) {
    console.error('Add property error:', insertError)
    return { error: 'Failed to save property. Please try again.' }
  }

  revalidatePath('/dashboard')
  redirect(`/properties/${property.id}`)
}
