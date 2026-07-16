'use server'

import { createClient } from '@/lib/supabase/server'

export type TenantProfile = {
  first_name: string
  last_name: string
  email: string
  status: string
}

export async function getTenantProfile(): Promise<TenantProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('tenants')
    .select('first_name, last_name, email, status')
    .eq('auth_id', user.id)
    .maybeSingle()

  return data ?? null
}
