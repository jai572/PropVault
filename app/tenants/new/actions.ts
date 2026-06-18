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

  // Get the internal user record to determine legal_entity_id
  const { data: internalUser } = await supabase
    .from('users')
    .select('id, legal_entity_id, role')
    .eq('auth_id', user.id)
    .single()

  if (!internalUser) redirect('/login')

  const firstName = sanitiseText(formData.get('first_name') as string ?? '')
  const lastName  = sanitiseText(formData.get('last_name')  as string ?? '')
  const email     = sanitiseText(formData.get('email')      as string ?? '').toLowerCase()
  const phone     = sanitiseText(formData.get('phone')      as string ?? '')

  if (!firstName || !lastName || !email) {
    return { error: 'First name, last name, and email are required.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  // Check for internal user email collision (global — internal users span all entities)
  const { data: existingInternalUser } = await supabase
    .from('users')
    .select('name, role')
    .eq('email', email)
    .maybeSingle()

  if (existingInternalUser) {
    return {
      error: `This email belongs to an internal user (${existingInternalUser.name}). Internal users cannot be added as prospective tenants.`,
    }
  }

  // Duplicate email check scoped by legal entity.
  // super_admin has legal_entity_id = null — they operate across all entities,
  // so their duplicate check is global (any prospective/active tenant with this email).
  // owner/manager: scoped to tenants created by users in the same legal entity.
  let duplicateQuery = supabase
    .from('tenants')
    .select('id, first_name, last_name, status, created_by_user_id')
    .eq('email', email)
    .in('status', ['prospective', 'active'])

  if (internalUser.role !== 'super_admin' && internalUser.legal_entity_id) {
    // Scope to tenants created by users belonging to the same legal entity
    const { data: entityUserIds } = await supabase
      .from('users')
      .select('id')
      .eq('legal_entity_id', internalUser.legal_entity_id)

    const ids = (entityUserIds ?? []).map((u) => u.id)
    duplicateQuery = duplicateQuery.in('created_by_user_id', ids)
  }

  const { data: existingTenant } = await duplicateQuery.maybeSingle()

  if (existingTenant) {
    const name = `${existingTenant.first_name} ${existingTenant.last_name}`
    const statusLabel = existingTenant.status === 'active' ? 'an active tenant' : 'a prospective tenant'
    return {
      error: `${name} (${email}) already exists as ${statusLabel} under this entity. Check the Tenants list.`,
    }
  }

  const token = crypto.randomUUID()

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      status: 'prospective',
      unique_link_token: token,
      created_by_user_id: internalUser.id,
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Failed to create tenant. Please try again.' }
  }

  return { token, tenantId: data.id }
}
