import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AddPropertyForm from './AddPropertyForm'

export default async function AddPropertyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: internalUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!internalUser) redirect('/login')

  // Fetch legal entities this user can add properties to
  let legalEntityQuery
  if (internalUser.role === 'super_admin') {
    legalEntityQuery = supabase.from('legal_entities').select('id, name, type').order('name')
  } else {
    const { data: entityLinks } = await supabase
      .from('user_legal_entities')
      .select('legal_entity_id')
      .eq('user_id', internalUser.id)
    const ids = (entityLinks ?? []).map(e => e.legal_entity_id as string)
    legalEntityQuery = ids.length > 0
      ? supabase.from('legal_entities').select('id, name, type').in('id', ids).order('name')
      : { data: [] }
  }

  const { data: entitiesRaw } = await legalEntityQuery
  const legalEntities = (entitiesRaw ?? []).map((e: Record<string, unknown>) => ({
    id:   e.id as string,
    name: e.name as string,
    type: e.type as string,
  }))

  return (
    <div className="max-w-lg space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Add property</h1>
        <p className="mt-1 text-sm text-gray-500">Register a new property in your portfolio.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <AddPropertyForm legalEntities={legalEntities} />
      </div>
    </div>
  )
}
