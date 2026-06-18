'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Cancel: hard delete — only allowed when no documents exist for this tenant
export async function cancelTenant(tenantId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Confirm tenant exists and is prospective
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .single()

  if (!tenant) return { error: 'Tenant not found.' }
  if (tenant.status !== 'prospective') return { error: 'Only prospective tenants can be cancelled.' }

  // Check for documents using service client (documents table has no tenant_id — check by path prefix)
  const serviceClient = createServiceClient()
  const { data: docs } = await serviceClient
    .from('documents')
    .select('id')
    .eq('type', 'right_to_rent')
    .like('file_url', `${tenantId}/%`)
    .limit(1)

  if (docs && docs.length > 0) {
    return { error: 'Cannot cancel — documents have been submitted. Use Archive instead.' }
  }

  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId)

  if (error) return { error: 'Failed to cancel tenant. Please try again.' }

  revalidatePath('/tenants')
  return {}
}

// Archive: sets status = withdrawn, nullifies token — documents retained
export async function archiveTenant(tenantId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .single()

  if (!tenant) return { error: 'Tenant not found.' }
  if (tenant.status !== 'prospective') return { error: 'Only prospective tenants can be archived.' }

  const { error } = await supabase
    .from('tenants')
    .update({ status: 'withdrawn', unique_link_token: null })
    .eq('id', tenantId)

  if (error) return { error: 'Failed to archive tenant. Please try again.' }

  revalidatePath('/tenants')
  return {}
}
