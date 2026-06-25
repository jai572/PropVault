'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sanitiseText, sanitiseFilename } from '@/lib/utils/sanitise'
import { generatePRT } from '@/lib/prt/generate'

export interface CreateTenancyState {
  error?: string
  tenancyId?: string
  tenancyReference?: string
}

const MAX_PDF_SIZE = 20 * 1024 * 1024 // 20MB
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ── Shared helper: parse and validate tenancy form fields ─────────────────────
function parseFields(formData: FormData): {
  error?: string
  propertyId: string
  roomReference: string | null
  startDate: string
  rentAmount: number
  rentDueDay: number
  depositAmount: number | null
  depositScheme: string | null
  depositReference: string | null
} {
  const propertyId       = sanitiseText(formData.get('property_id')       as string ?? '')
  const roomReference    = sanitiseText(formData.get('room_reference')    as string ?? '') || null
  const startDate        = sanitiseText(formData.get('start_date')        as string ?? '')
  const rentAmountRaw    = sanitiseText(formData.get('rent_amount')       as string ?? '')
  const rentDueDayRaw    = sanitiseText(formData.get('rent_due_day')      as string ?? '')
  const depositAmountRaw = sanitiseText(formData.get('deposit_amount')    as string ?? '')
  const depositScheme    = sanitiseText(formData.get('deposit_scheme')    as string ?? '') || null
  const depositReference = sanitiseText(formData.get('deposit_reference') as string ?? '') || null

  if (!propertyId)    return { error: 'Please select a property.', propertyId: '', roomReference: null, startDate: '', rentAmount: 0, rentDueDay: 0, depositAmount: null, depositScheme: null, depositReference: null }
  if (!startDate)     return { error: 'Please enter a start date.', propertyId, roomReference, startDate: '', rentAmount: 0, rentDueDay: 0, depositAmount: null, depositScheme, depositReference }
  if (!DATE_RE.test(startDate)) return { error: 'Invalid start date format.', propertyId, roomReference, startDate, rentAmount: 0, rentDueDay: 0, depositAmount: null, depositScheme, depositReference }

  const rentAmount = parseFloat(rentAmountRaw)
  const rentDueDay = parseInt(rentDueDayRaw, 10)
  if (!rentAmountRaw || isNaN(rentAmount) || rentAmount <= 0) return { error: 'Please enter a valid monthly rent.', propertyId, roomReference, startDate, rentAmount: 0, rentDueDay: 0, depositAmount: null, depositScheme, depositReference }
  if (!rentDueDayRaw || isNaN(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) return { error: 'Rent due day must be between 1 and 28.', propertyId, roomReference, startDate, rentAmount, rentDueDay: 0, depositAmount: null, depositScheme, depositReference }

  const depositAmount = depositAmountRaw ? parseFloat(depositAmountRaw) : null
  if (depositAmount !== null && (isNaN(depositAmount) || depositAmount < 0)) return { error: 'Invalid deposit amount.', propertyId, roomReference, startDate, rentAmount, rentDueDay, depositAmount: null, depositScheme, depositReference }

  return { propertyId, roomReference, startDate, rentAmount, rentDueDay, depositAmount, depositScheme, depositReference }
}

// ── Shared helper: create tenancy + tenancy_tenant rows ───────────────────────
async function insertTenancy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    propertyId: string
    isHmo: boolean
    internalUserId: string
    tenantId: string
    startDate: string
    rentAmount: number
    rentDueDay: number
    depositAmount: number | null
    depositScheme: string | null
    depositReference: string | null
    roomReference: string | null
  }
): Promise<{ tenancyId: string; tenancyReference: string } | { error: string }> {
  // For non-HMO properties, block if an active tenancy already exists
  if (!args.isHmo) {
    const { count } = await supabase
      .from('tenancies')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', args.propertyId)
      .eq('status', 'active')

    if (count && count > 0) {
      return { error: 'This property already has an active tenancy and is not marked as an HMO. Close the existing tenancy before creating a new one.' }
    }
  }

  const { data: tenancy, error: tenancyError } = await supabase
    .from('tenancies')
    .insert({
      property_id:       args.propertyId,
      landlord_id:       args.internalUserId,
      status:            'active',
      start_date:        args.startDate,
      end_date:          null,
      rent_amount:       args.rentAmount,
      rent_due_day:      args.rentDueDay,
      deposit_amount:    args.depositAmount,
      deposit_scheme:    args.depositScheme,
      deposit_reference: args.depositReference,
      room_reference:    args.roomReference,
      jurisdiction:      'scotland',
      tenancy_reference: '',
    })
    .select('id, tenancy_reference')
    .single()

  if (tenancyError || !tenancy) {
    console.error('Tenancy insert error:', tenancyError)
    return { error: 'Failed to create tenancy record. Please try again.' }
  }

  const { error: ttError } = await supabase
    .from('tenancy_tenants')
    .insert({ tenancy_id: tenancy.id, tenant_id: args.tenantId, is_lead_tenant: true })

  if (ttError) {
    await supabase.from('tenancies').delete().eq('id', tenancy.id)
    return { error: 'Failed to link tenant to tenancy. Please try again.' }
  }

  // Mark property as occupied (use service client to bypass any RLS gaps)
  const svc = createServiceClient()
  await svc.from('properties').update({ status: 'occupied' }).eq('id', args.propertyId)

  return { tenancyId: tenancy.id, tenancyReference: tenancy.tenancy_reference }
}

// ── Shared helper: activate tenant + send invite ───────────────────────────────
async function activateTenant(tenantId: string, tenantEmail: string) {
  const serviceClient = createServiceClient()
  await serviceClient.from('tenants').update({ status: 'active' }).eq('id', tenantId)
  const { error } = await serviceClient.auth.admin.inviteUserByEmail(tenantEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/dashboard`,
  })
  if (error) console.error('Auth invite error:', error)
}

// ── Shared setup: auth + tenant validation ────────────────────────────────────
async function resolveContext(tenantId: string, internalUserId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, email, status, right_to_rent_verified')
    .eq('id', tenantId)
    .single()

  if (!tenant)                          return { error: 'Tenant not found.' }
  if (!tenant.right_to_rent_verified)   return { error: 'Right to Rent must be verified before creating a tenancy.' }
  if (tenant.status === 'active')       return { error: 'This tenant already has an active tenancy record.' }
  if (tenant.status === 'purged')       return { error: 'Cannot create a tenancy for a purged tenant.' }

  const { data: internalUser } = await supabase.from('users').select('id').eq('id', internalUserId).single()
  if (!internalUser) return { error: 'Internal user not found.' }

  return { tenant, internalUser }
}

// ── Action: generate PRT ──────────────────────────────────────────────────────
export async function createTenancyAndGeneratePRT(
  tenantId: string,
  internalUserId: string,
  _prev: CreateTenancyState,
  formData: FormData
): Promise<CreateTenancyState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = parseFields(formData)
  if (fields.error) return { error: fields.error }

  const ctx = await resolveContext(tenantId, internalUserId, supabase)
  if ('error' in ctx) return { error: ctx.error }
  const { tenant, internalUser } = ctx

  const { data: property } = await supabase
    .from('properties')
    .select('id, address_line_1, address_line_2, city, postcode, is_hmo, hmo_licence_number, hmo_licence_expiry, has_gas, legal_entity_id')
    .eq('id', fields.propertyId)
    .single()
  if (!property) return { error: 'Property not found or not accessible.' }

  const { data: legalEntity } = await supabase
    .from('legal_entities')
    .select('name, landlord_registration_number, address, email, telephone')
    .eq('id', property.legal_entity_id)
    .single()
  if (!legalEntity) return { error: 'Could not retrieve landlord details for this property.' }

  const result = await insertTenancy(supabase, {
    propertyId: property.id, isHmo: property.is_hmo, internalUserId: internalUser.id, tenantId,
    startDate: fields.startDate, rentAmount: fields.rentAmount, rentDueDay: fields.rentDueDay,
    depositAmount: fields.depositAmount, depositScheme: fields.depositScheme,
    depositReference: fields.depositReference, roomReference: fields.roomReference,
  })
  if ('error' in result) return { error: result.error }

  const propertyAddress = [property.address_line_1, property.address_line_2, property.city, property.postcode].filter(Boolean).join(', ')

  // Read PRT-specific form fields
  const tenantDob            = sanitiseText(formData.get('tenant_dob')             as string ?? '') || null
  const tenantPassport       = sanitiseText(formData.get('tenant_passport')        as string ?? '') || null
  const tenantNationality    = sanitiseText(formData.get('tenant_nationality')     as string ?? '') || null
  const tenantCurrentAddress = sanitiseText(formData.get('tenant_current_address') as string ?? '') || null
  const propertyType         = sanitiseText(formData.get('property_type')          as string ?? '') || null
  const furnishedStatus      = sanitiseText(formData.get('furnished_status')       as string ?? '') || null

  // Fetch property facilities (set on the property record, not from the form)
  const { data: facilitiesData } = await supabase
    .from('property_facilities')
    .select('facility_name, type')
    .eq('property_id', property.id)
    .order('sort_order', { ascending: true })

  const facilities = facilitiesData ?? []
  const joinNames = (type: string) => {
    const names = facilities.filter(f => f.type === type).map(f => f.facility_name)
    return names.length > 0 ? names.join(', ') : null
  }
  const includedAreas = joinNames('included')
  const sharedAreas   = joinNames('shared')
  const excludedAreas = joinNames('excluded')

  // Format DOB for display if provided (ISO → "DD Month YYYY")
  let dobDisplay: string | null = null
  if (tenantDob && /^\d{4}-\d{2}-\d{2}$/.test(tenantDob)) {
    const d = new Date(tenantDob + 'T00:00:00')
    dobDisplay = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const prtBytes = await generatePRT({
    tenancyReference: result.tenancyReference,
    tenants: [{
      fullName: `${tenant.first_name} ${tenant.last_name}`,
      dateOfBirth: dobDisplay,
      passportNumber: tenantPassport,
      nationality: tenantNationality,
      currentAddress: tenantCurrentAddress,
      email: tenant.email,
    }],
    landlordName: legalEntity.name,
    landlordRegistrationNumber: legalEntity.landlord_registration_number ?? null,
    landlordAddress: legalEntity.address ?? null,
    landlordEmail: legalEntity.email ?? null,
    landlordTelephone: legalEntity.telephone ?? null,
    propertyAddress,
    propertyType,
    furnishedStatus,
    isHmo: property.is_hmo,
    hmoLicenceNumber: property.hmo_licence_number ?? null,
    includedAreas,
    sharedAreas,
    excludedAreas,
    hasGas: property.has_gas,
    startDate: fields.startDate,
    rentAmount: fields.rentAmount,
    rentDueDay: fields.rentDueDay,
    depositAmount: fields.depositAmount,
    depositScheme: fields.depositScheme,
    depositReference: fields.depositReference,
    includeSection37: legalEntity.name === 'TJ Property Consultants Ltd',
  })

  const serviceClient = createServiceClient()
  const prtPath = `${result.tenancyId}/${result.tenancyReference}.pdf`

  const { error: storageError } = await serviceClient.storage
    .from('prt-documents')
    .upload(prtPath, prtBytes, { contentType: 'application/pdf', upsert: false })

  if (storageError) {
    console.error('PRT storage error:', storageError)
  } else {
    await serviceClient.from('documents').insert({
      tenancy_id: result.tenancyId, property_id: property.id,
      type: 'PRT', file_url: prtPath,
      uploaded_by: internalUser.id, delivered_to_tenant: false,
    })
  }

  await activateTenant(tenantId, tenant.email)
  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants')
  return { tenancyId: result.tenancyId, tenancyReference: result.tenancyReference }
}

// ── Action: upload existing signed PRT ───────────────────────────────────────
export async function createTenancyWithUpload(
  tenantId: string,
  internalUserId: string,
  _prev: CreateTenancyState,
  formData: FormData
): Promise<CreateTenancyState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = parseFields(formData)
  if (fields.error) return { error: fields.error }

  // Validate uploaded PDF
  const file = formData.get('prt_file') as File | null
  if (!file || !(file instanceof File) || file.size === 0) return { error: 'Please upload the signed PRT document (PDF).' }
  if (file.type !== 'application/pdf') return { error: 'The signed PRT must be a PDF file.' }
  if (file.size > MAX_PDF_SIZE) return { error: 'File must be under 20MB.' }

  const ctx = await resolveContext(tenantId, internalUserId, supabase)
  if ('error' in ctx) return { error: ctx.error }
  const { tenant, internalUser } = ctx

  const { data: property } = await supabase
    .from('properties')
    .select('id, is_hmo, legal_entity_id')
    .eq('id', fields.propertyId)
    .single()
  if (!property) return { error: 'Property not found or not accessible.' }

  const result = await insertTenancy(supabase, {
    propertyId: property.id, isHmo: property.is_hmo, internalUserId: internalUser.id, tenantId,
    startDate: fields.startDate, rentAmount: fields.rentAmount, rentDueDay: fields.rentDueDay,
    depositAmount: fields.depositAmount, depositScheme: fields.depositScheme,
    depositReference: fields.depositReference, roomReference: fields.roomReference,
  })
  if ('error' in result) return { error: result.error }

  // Upload the provided signed PDF
  const safeName = sanitiseFilename(file.name)
  const prtPath  = `${result.tenancyId}/${result.tenancyReference}_signed_${safeName}`
  const buf      = await file.arrayBuffer()

  const serviceClient = createServiceClient()
  const { error: storageError } = await serviceClient.storage
    .from('prt-documents')
    .upload(prtPath, buf, { contentType: 'application/pdf', upsert: false })

  if (storageError) {
    console.error('PRT upload storage error:', storageError)
    // Non-fatal: tenancy created; PRT can be re-uploaded
  } else {
    await serviceClient.from('documents').insert({
      tenancy_id: result.tenancyId, property_id: property.id,
      type: 'PRT', file_url: prtPath,
      uploaded_by: internalUser.id, delivered_to_tenant: true, // pre-signed so already delivered
    })
  }

  await activateTenant(tenantId, tenant.email)
  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants')
  return { tenancyId: result.tenancyId, tenancyReference: result.tenancyReference }
}
