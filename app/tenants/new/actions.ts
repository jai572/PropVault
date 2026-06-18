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

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
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
    if (error.code === '23505') {
      return { error: 'A tenant with this email already exists.' }
    }
    return { error: 'Failed to create tenant. Please try again.' }
  }

  return { token, tenantId: data.id }
}
