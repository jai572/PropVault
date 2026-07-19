'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type EndTenancyState = { error?: string; success?: boolean }

export async function endTenancy(
  _prev: EndTenancyState,
  formData: FormData
): Promise<EndTenancyState> {
  const tenancyId  = formData.get('tenancy_id')  as string
  const propertyId = formData.get('property_id') as string

  if (!tenancyId || !propertyId) return { error: 'Missing required fields.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const today = new Date().toISOString().slice(0, 10)

  // Close the tenancy (RLS ensures the user owns it)
  const { error: tenancyError } = await supabase
    .from('tenancies')
    .update({ status: 'closed', end_date: today, closed_at: new Date().toISOString() })
    .eq('id', tenancyId)
    .eq('status', 'active')

  if (tenancyError) return { error: 'Could not end tenancy. Please try again.' }

  // Set property back to available
  await supabase
    .from('properties')
    .update({ status: 'available' })
    .eq('id', propertyId)

  revalidatePath(`/properties/${propertyId}`)
  return { success: true }
}
