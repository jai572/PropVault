'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitiseText } from '@/lib/utils/sanitise'

export interface VerifyRightToRentState {
  error?: string
  success?: boolean
}

export async function verifyRightToRent(
  tenantId: string,
  _prev: VerifyRightToRentState,
  formData: FormData
): Promise<VerifyRightToRentState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const documentType = sanitiseText(formData.get('document_type') as string ?? '')
  const checkedDate  = sanitiseText(formData.get('checked_date')  as string ?? '')
  const expiryDate   = sanitiseText(formData.get('expiry_date')   as string ?? '')

  if (!documentType) return { error: 'Please select a document type.' }
  if (!checkedDate)  return { error: 'Please enter the date you checked the documents.' }

  // Validate date formats (YYYY-MM-DD from date inputs)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(checkedDate)) return { error: 'Invalid checked date.' }
  if (expiryDate && !dateRegex.test(expiryDate)) return { error: 'Invalid expiry date.' }

  // Confirm tenant exists and is accessible via RLS
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .single()

  if (!tenant) return { error: 'Tenant not found.' }
  if (tenant.status === 'purged') return { error: 'Cannot update a purged tenant record.' }

  const { error } = await supabase
    .from('tenants')
    .update({
      right_to_rent_verified: true,
      right_to_rent_checked_date: checkedDate,
      right_to_rent_document_type: documentType,
      right_to_rent_expiry: expiryDate || null,
    })
    .eq('id', tenantId)

  if (error) return { error: 'Failed to save verification. Please try again.' }

  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants')
  return { success: true }
}
