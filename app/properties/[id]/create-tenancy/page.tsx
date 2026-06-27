import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import TenantSelectionWizard from './TenantSelectionWizard'
import type { Property } from '@/types'

type TenantOption = {
  id: string
  first_name: string
  last_name: string
  email: string
  status: 'prospective' | 'closed'
  legal_entity_name?: string | null
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyCreateTenancyPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: internalUser }, { data: property }] = await Promise.all([
    supabase.from('users').select('id, role').eq('auth_id', user.id).single(),
    supabase
      .from('properties')
      .select('id, address_line_1, address_line_2, city, postcode, is_hmo, status, legal_entity_id')
      .eq('id', id)
      .single<Pick<Property, 'id' | 'address_line_1' | 'address_line_2' | 'city' | 'postcode' | 'is_hmo' | 'status' | 'legal_entity_id'>>(),
  ])

  if (!internalUser) redirect('/login')
  if (!property) notFound()

  const isSuperAdmin = internalUser.role === 'super_admin'

  // super_admin sees all entities; owner/manager scoped to the property's entity
  const { data: tenantData } = isSuperAdmin
    ? await supabase
        .from('tenants')
        .select('id, first_name, last_name, email, status, legal_entities(name)')
        .in('status', ['prospective', 'closed'])
        .eq('right_to_rent_verified', true)
        .order('last_name')
    : property.legal_entity_id
      ? await supabase
          .from('tenants')
          .select('id, first_name, last_name, email, status')
          .in('status', ['prospective', 'closed'])
          .eq('right_to_rent_verified', true)
          .eq('legal_entity_id', property.legal_entity_id)
          .order('last_name')
      : { data: [] }

  const availableTenants: TenantOption[] = (tenantData ?? []).map((t: Record<string, unknown>) => ({
    id:                t.id as string,
    first_name:        t.first_name as string,
    last_name:         t.last_name as string,
    email:             t.email as string,
    status:            t.status as 'prospective' | 'closed',
    legal_entity_name: isSuperAdmin ? ((t.legal_entities as { name: string } | null)?.name ?? null) : null,
  }))

  const addressLine = [property.address_line_1, property.address_line_2].filter(Boolean).join(', ')

  return (
    <div className="max-w-lg space-y-6">
      <Link
        href={`/properties/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> {addressLine}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Create Private Residential Tenancy</h1>
        <p className="mt-1 text-sm text-gray-500">
          {addressLine}, {property.city}, {property.postcode}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TenantSelectionWizard
          propertyId={id}
          availableTenants={availableTenants}
          showEntityName={isSuperAdmin}
        />
      </div>
    </div>
  )
}
