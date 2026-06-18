import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewTenantForm from './NewTenantForm'
import type { LegalEntity } from '@/types'

export default async function NewTenantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, legal_entity_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // super_admin needs a legal entity selector — fetch all entities
  let legalEntities: Pick<LegalEntity, 'id' | 'name'>[] = []
  if (profile.role === 'super_admin') {
    const { data } = await supabase
      .from('legal_entities')
      .select('id, name')
      .order('name')
    legalEntities = data ?? []
  }

  return (
    <NewTenantForm
      isSuperAdmin={profile.role === 'super_admin'}
      ownLegalEntityId={profile.legal_entity_id}
      legalEntities={legalEntities}
    />
  )
}
