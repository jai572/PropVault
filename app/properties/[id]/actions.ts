'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitiseText } from '@/lib/utils/sanitise'

export interface FacilityState {
  error?: string
}

const VALID_TYPES = ['included', 'shared', 'excluded'] as const
type FacilityType = typeof VALID_TYPES[number]

export async function addFacility(
  propertyId: string,
  _prev: FacilityState,
  formData: FormData
): Promise<FacilityState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = sanitiseText(formData.get('facility_name') as string ?? '').trim()
  const type = sanitiseText(formData.get('facility_type') as string ?? '') as FacilityType

  if (!name)                       return { error: 'Facility name is required.' }
  if (!VALID_TYPES.includes(type)) return { error: 'Invalid facility type.' }
  if (name.length > 120)           return { error: 'Facility name must be 120 characters or fewer.' }

  // Determine next sort_order
  const { data: maxRow } = await supabase
    .from('property_facilities')
    .select('sort_order')
    .eq('property_id', propertyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sortOrder = maxRow ? maxRow.sort_order + 1 : 0

  const { error } = await supabase.from('property_facilities').insert({
    property_id: propertyId,
    facility_name: name,
    type,
    sort_order: sortOrder,
  })

  if (error) return { error: 'Failed to add facility. Please try again.' }

  revalidatePath(`/properties/${propertyId}`)
  return {}
}

export async function removeFacility(propertyId: string, facilityId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('property_facilities').delete().eq('id', facilityId)
  revalidatePath(`/properties/${propertyId}`)
}

export async function resolveComm(propertyId: string, commId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('communications')
    .update({ status: 'resolved' })
    .eq('id', commId)

  if (error) return { error: 'Failed to resolve communication.' }
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/dashboard')
  return {}
}

export async function completeMaintJob(propertyId: string, jobId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('maintenance_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId)

  if (error) return { error: 'Failed to complete maintenance job.' }
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/dashboard')
  return {}
}
