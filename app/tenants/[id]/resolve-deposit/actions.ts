'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitiseText } from '@/lib/utils/sanitise'

export interface ResolveDepositState {
  error?: string
  success?: boolean
}

const STATUSES = ['refunded', 'retained', 'disputed'] as const
type DepositStatus = typeof STATUSES[number]

export async function resolveDeposit(
  tenantId: string,
  tenancyId: string,
  _prev: ResolveDepositState,
  formData: FormData
): Promise<ResolveDepositState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const statusRaw        = sanitiseText(formData.get('deposit_status')        as string ?? '') as DepositStatus
  const refundAmountRaw  = sanitiseText(formData.get('deposit_refund_amount') as string ?? '')
  const notes            = sanitiseText(formData.get('deposit_resolution_notes') as string ?? '') || null

  if (!STATUSES.includes(statusRaw)) return { error: 'Please select a deposit outcome.' }

  let refundAmount: number | null = null
  if (refundAmountRaw) {
    refundAmount = parseFloat(refundAmountRaw)
    if (isNaN(refundAmount) || refundAmount < 0) return { error: 'Invalid refund amount.' }
  }

  // Confirm tenancy is accessible and closed with pending deposit
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('id, status, deposit_status, deposit_amount')
    .eq('id', tenancyId)
    .single()

  if (!tenancy)                         return { error: 'Tenancy not found.' }
  if (tenancy.status !== 'closed')      return { error: 'Deposit can only be resolved on a closed tenancy.' }
  if (tenancy.deposit_status !== 'pending') return { error: 'Deposit has already been resolved.' }

  const { error } = await supabase
    .from('tenancies')
    .update({
      deposit_status:            statusRaw,
      deposit_refund_amount:     refundAmount,
      deposit_resolution_notes:  notes,
      deposit_resolved_at:       new Date().toISOString(),
    })
    .eq('id', tenancyId)

  if (error) return { error: 'Failed to save deposit resolution. Please try again.' }

  revalidatePath(`/tenants/${tenantId}`)
  return { success: true }
}
