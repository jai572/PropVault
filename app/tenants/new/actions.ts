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

  // Check for existing tenant with this email (prospective or active)
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, status')
    .eq('email', email)
    .in('status', ['prospective', 'active'])
    .maybeSingle()

  if (existingTenant) {
    const name = `${existingTenant.first_name} ${existingTenant.last_name}`
    const statusLabel = existingTenant.status === 'active' ? 'an active tenant' : 'a prospective tenant'
    return {
      error: `${name} (${email}) already exists as ${statusLabel}. Check the Tenants list.`,
    }
  }

  // Warn if email matches an internal user (landlord/manager)
  const { data: internalUser } = await supabase
    .from('users')
    .select('name, role')
    .eq('email', email)
    .maybeSingle()

  if (internalUser) {
    return {
      error: `This email belongs to an internal user (${internalUser.name}, ${internalUser.role.replace('_', ' ')}). Internal users cannot be added as prospective tenants.`,
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
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Failed to create tenant. Please try again.' }
  }

  return { token, tenantId: data.id }
}
