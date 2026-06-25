'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sanitiseText } from '@/lib/utils/sanitise'

export interface CloseTenancyState {
  error?: string
  success?: boolean
}

const DATE_RE   = /^\d{4}-\d{2}-\d{2}$/
const REASONS   = ['tenant_notice', 'landlord_notice', 'mutual_agreement', 'other'] as const
type Reason = typeof REASONS[number]

export async function closeTenancy(
  tenantId: string,
  tenancyId: string,
  propertyId: string,
  _prev: CloseTenancyState,
  formData: FormData
): Promise<CloseTenancyState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const endDate           = sanitiseText(formData.get('end_date')             as string ?? '')
  const reason            = sanitiseText(formData.get('closure_reason')       as string ?? '') as Reason
  const reasonOther       = sanitiseText(formData.get('closure_reason_other') as string ?? '') || null
  const notes             = sanitiseText(formData.get('closure_notes')        as string ?? '') || null

  if (!endDate)                return { error: 'Please enter an end date.' }
  if (!DATE_RE.test(endDate))  return { error: 'Invalid end date format.' }
  if (!REASONS.includes(reason)) return { error: 'Please select a reason for ending the tenancy.' }
  if (reason === 'other' && !reasonOther) return { error: 'Please describe the reason in the text field.' }

  // Confirm tenancy is accessible and currently active
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('id, status')
    .eq('id', tenancyId)
    .single()

  if (!tenancy)                    return { error: 'Tenancy not found.' }
  if (tenancy.status !== 'active') return { error: 'This tenancy is already closed.' }

  const { error: updateError } = await supabase
    .from('tenancies')
    .update({
      status:               'closed',
      end_date:             endDate,
      closed_at:            new Date().toISOString(),
      closure_reason:       reason,
      closure_reason_other: reason === 'other' ? reasonOther : null,
      closure_notes:        notes,
    })
    .eq('id', tenancyId)

  if (updateError) return { error: 'Failed to close tenancy. Please try again.' }

  // Revert property to available unless other active tenancies remain (HMO)
  const { count: activeCount } = await supabase
    .from('tenancies')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('status', 'active')

  if (!activeCount || activeCount === 0) {
    const svc = createServiceClient()
    await svc.from('properties').update({ status: 'available' }).eq('id', propertyId)
  }

  // Move tenant to closed status
  await supabase.from('tenants').update({ status: 'closed' }).eq('id', tenantId)

  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants')
  revalidatePath(`/properties/${propertyId}`)

  return { success: true }
}
