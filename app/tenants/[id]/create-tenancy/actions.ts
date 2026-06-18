'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sanitiseText } from '@/lib/utils/sanitise'
import { generatePRT } from '@/lib/prt/generate'

export interface CreateTenancyState {
  error?: string
  tenancyId?: string
  tenancyReference?: string
}

export async function createTenancy(
  tenantId: string,
  internalUserId: string,
  _prev: CreateTenancyState,
  formData: FormData
): Promise<CreateTenancyState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Parse and validate inputs ─────────────────────────────────────────────
  const propertyId      = sanitiseText(formData.get('property_id')      as string ?? '')
  const roomReference   = sanitiseText(formData.get('room_reference')   as string ?? '') || null
  const startDate       = sanitiseText(formData.get('start_date')       as string ?? '')
  const rentAmountRaw   = sanitiseText(formData.get('rent_amount')      as string ?? '')
  const rentDueDayRaw   = sanitiseText(formData.get('rent_due_day')     as string ?? '')
  const depositAmountRaw = sanitiseText(formData.get('deposit_amount')  as string ?? '')
  const depositScheme   = sanitiseText(formData.get('deposit_scheme')   as string ?? '') || null
  const depositReference = sanitiseText(formData.get('deposit_reference') as string ?? '') || null

  if (!propertyId)  return { error: 'Please select a property.' }
  if (!startDate)   return { error: 'Please enter a start date.' }
  if (!rentAmountRaw) return { error: 'Please enter the monthly rent.' }
  if (!rentDueDayRaw) return { error: 'Please enter the rent due day.' }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(startDate)) return { error: 'Invalid start date.' }

  const rentAmount = parseFloat(rentAmountRaw)
  const rentDueDay = parseInt(rentDueDayRaw, 10)

  if (isNaN(rentAmount) || rentAmount <= 0) return { error: 'Rent must be a positive amount.' }
  if (isNaN(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) return { error: 'Rent due day must be between 1 and 28.' }

  const depositAmount = depositAmountRaw ? parseFloat(depositAmountRaw) : null
  if (depositAmount !== null && isNaN(depositAmount)) return { error: 'Invalid deposit amount.' }

  // ── Verify tenant is accessible and Right to Rent is confirmed ────────────
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, email, status, right_to_rent_verified')
    .eq('id', tenantId)
    .single()

  if (!tenant) return { error: 'Tenant not found.' }
  if (!tenant.right_to_rent_verified) return { error: 'Right to Rent must be verified before creating a tenancy.' }
  if (tenant.status === 'active') return { error: 'This tenant already has an active tenancy.' }
  if (tenant.status === 'purged') return { error: 'Cannot create a tenancy for a purged tenant.' }

  // ── Fetch property details ────────────────────────────────────────────────
  const { data: property } = await supabase
    .from('properties')
    .select('id, address_line_1, address_line_2, city, postcode, is_hmo, hmo_licence_number, hmo_licence_expiry, legal_entity_id')
    .eq('id', propertyId)
    .single()

  if (!property) return { error: 'Property not found or not accessible.' }

  // ── Fetch legal entity (landlord) details ─────────────────────────────────
  const { data: legalEntity } = await supabase
    .from('legal_entities')
    .select('id, name, landlord_registration_number, council_area')
    .eq('id', property.legal_entity_id)
    .single()

  if (!legalEntity) return { error: 'Could not retrieve landlord details for this property.' }

  // ── Fetch the internal user (for landlord_id on tenancy row) ─────────────
  const { data: internalUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', internalUserId)
    .single()

  if (!internalUser) return { error: 'Internal user not found.' }

  // ── Build full property address ───────────────────────────────────────────
  const propertyAddress = [
    property.address_line_1,
    property.address_line_2,
    property.city,
    property.postcode,
  ].filter(Boolean).join(', ')

  // ── Insert tenancy record ─────────────────────────────────────────────────
  const { data: tenancy, error: tenancyError } = await supabase
    .from('tenancies')
    .insert({
      property_id:       property.id,
      landlord_id:       internalUser.id,
      status:            'active',
      start_date:        startDate,
      end_date:          null,
      rent_amount:       rentAmount,
      rent_due_day:      rentDueDay,
      deposit_amount:    depositAmount,
      deposit_scheme:    depositScheme,
      deposit_reference: depositReference,
      room_reference:    roomReference,
      jurisdiction:      'scotland',
      tenancy_reference: '', // trigger overwrites this
    })
    .select('id, tenancy_reference')
    .single()

  if (tenancyError || !tenancy) {
    console.error('Tenancy insert error:', tenancyError)
    return { error: 'Failed to create tenancy record. Please try again.' }
  }

  // ── Link tenant to tenancy ────────────────────────────────────────────────
  const { error: ttError } = await supabase
    .from('tenancy_tenants')
    .insert({ tenancy_id: tenancy.id, tenant_id: tenantId, is_lead_tenant: true })

  if (ttError) {
    // Best-effort rollback of tenancy row
    await supabase.from('tenancies').delete().eq('id', tenancy.id)
    return { error: 'Failed to link tenant to tenancy. Please try again.' }
  }

  // ── Generate PRT PDF ──────────────────────────────────────────────────────
  const prtBytes = await generatePRT({
    tenancyReference:          tenancy.tenancy_reference,
    landlordName:              legalEntity.name,
    landlordRegistrationNumber: legalEntity.landlord_registration_number,
    landlordCouncilArea:       legalEntity.council_area,
    landlordAddress:           legalEntity.council_area ?? 'Scotland',
    propertyAddress,
    isHmo:                     property.is_hmo,
    hmoLicenceNumber:          property.hmo_licence_number,
    hmoLicenceExpiry:          property.hmo_licence_expiry,
    tenantName:                `${tenant.first_name} ${tenant.last_name}`,
    tenantEmail:               tenant.email,
    startDate,
    rentAmount,
    rentDueDay,
    depositAmount,
    depositScheme,
    depositReference,
    roomReference,
  })

  // ── Upload PRT to storage ─────────────────────────────────────────────────
  const serviceClient = createServiceClient()
  const prtPath = `${tenancy.id}/${tenancy.tenancy_reference}.pdf`

  const { error: storageError } = await serviceClient.storage
    .from('prt-documents')
    .upload(prtPath, prtBytes, { contentType: 'application/pdf', upsert: false })

  if (storageError) {
    console.error('PRT storage error:', storageError)
    // Non-fatal: tenancy is created; log but continue
  } else {
    // Record document row
    await serviceClient
      .from('documents')
      .insert({
        tenancy_id:         tenancy.id,
        property_id:        property.id,
        type:               'PRT',
        file_url:           prtPath,
        uploaded_by:        internalUser.id,
        delivered_to_tenant: false,
      })
  }

  // ── Update tenant status to active ───────────────────────────────────────
  const { error: tenantUpdateError } = await serviceClient
    .from('tenants')
    .update({ status: 'active' })
    .eq('id', tenantId)

  if (tenantUpdateError) {
    console.error('Tenant status update error:', tenantUpdateError)
    // Non-fatal: tenancy exists; surface as warning but return success
  }

  // ── Send Supabase Auth invite ─────────────────────────────────────────────
  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(tenant.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/dashboard`,
  })

  if (inviteError) {
    // Invitation failure is non-fatal (can be resent manually); log and continue
    console.error('Auth invite error:', inviteError)
  }

  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants')

  return { tenancyId: tenancy.id, tenancyReference: tenancy.tenancy_reference }
}
