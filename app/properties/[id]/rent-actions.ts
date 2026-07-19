'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type MarkPaidState = { error?: string }

export async function markRentPaid(
  _prev: MarkPaidState,
  formData: FormData
): Promise<MarkPaidState> {
  const recordId  = formData.get('record_id')  as string
  const propertyId = formData.get('property_id') as string
  const amountPaid = parseFloat(formData.get('amount_paid') as string)
  const paidDate  = (formData.get('paid_date') as string) || null
  const notes     = (formData.get('notes') as string)     || null

  if (!recordId || isNaN(amountPaid) || amountPaid < 0) {
    return { error: 'Invalid payment details.' }
  }

  const supabase = await createClient()

  // Fetch the record to determine new status (RLS ensures landlord owns it)
  const { data: record, error: fetchError } = await supabase
    .from('rent_records')
    .select('amount_due')
    .eq('id', recordId)
    .single()

  if (fetchError || !record) {
    return { error: 'Rent record not found.' }
  }

  const amountDue = Number(record.amount_due)
  const newStatus =
    amountPaid <= 0          ? 'pending'
    : amountPaid >= amountDue ? 'paid'
    :                           'partial'

  const { error: updateError } = await supabase
    .from('rent_records')
    .update({
      amount_paid: amountPaid,
      paid_date:   newStatus === 'paid' ? (paidDate ?? new Date().toISOString().slice(0, 10)) : paidDate,
      status:      newStatus,
      notes,
    })
    .eq('id', recordId)

  if (updateError) {
    return { error: 'Could not update rent record. Please try again.' }
  }

  revalidatePath(`/properties/${propertyId}`)
  return {}
}
