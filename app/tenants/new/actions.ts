'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitiseText } from '@/lib/utils/sanitise'

export interface CreateTenantState {
  error?: string
  token?: string
  tenantId?: string
}

export async function createProspectiveTenant(
  _prev: CreateTenantState,
  formData: FormData
): Promise<CreateTenantState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: internalUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!internalUser) redirect('/login')

  const firstName      = sanitiseText(formData.get('first_name')    as string ?? '')
  const lastName       = sanitiseText(formData.get('last_name')     as string ?? '')
  const email          = sanitiseText(formData.get('email')         as string ?? '').toLowerCase()
  const phone          = sanitiseText(formData.get('phone')         as string ?? '')
  const legalEntityId  = sanitiseText(formData.get('legal_entity_id') as string ?? '')

  if (!firstName || !lastName || !email) {
    return { error: 'First name, last name, and email are required.' }
  }

  if (!legalEntityId) {
    return { error: 'A legal entity is required.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  // Block if email belongs to an internal user (global — spans all entities)
  const { data: existingInternalUser } = await supabase
    .from('users')
    .select('name')
    .eq('email', email)
    .maybeSingle()

  if (existingInternalUser) {
    return {
      error: `This email belongs to an internal user (${existingInternalUser.name}). Internal users cannot be added as prospective tenants.`,
    }
  }

  // Duplicate check scoped by legal_entity_id — applies equally to all roles including super_admin
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('first_name, last_name, status')
    .eq('email', email)
    .eq('legal_entity_id', legalEntityId)
    .in('status', ['prospective', 'active'])
    .maybeSingle()

  if (existingTenant) {
    const name = `${existingTenant.first_name} ${existingTenant.last_name}`
    const statusLabel = existingTenant.status === 'active' ? 'an active tenant' : 'a prospective tenant'
    return {
      error: `${name} (${email}) already exists as ${statusLabel} under this entity. Check the Tenants list.`,
    }
  }

  const token = crypto.randomUUID()
  const linkExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      status: 'prospective',
      unique_link_token: token,
      link_expires_at: linkExpiresAt,
      created_by_user_id: internalUser.id,
      legal_entity_id: legalEntityId,
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Failed to create tenant. Please try again.' }
  }

  return { token, tenantId: data.id }
}
