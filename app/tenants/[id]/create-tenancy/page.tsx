import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CreateTenancyForm from './CreateTenancyForm'
import type { Tenant, Property } from '@/types'

export type CoTenantOption = {
  id: string
  first_name: string
  last_name: string
  email: string
  legal_entity_name?: string | null
}

export default async function CreateTenancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ property_id?: string; co_tenant_ids?: string }>
}) {
  const { id } = await params
  const { property_id: defaultPropertyId, co_tenant_ids: coTenantIdsRaw } = await searchParams
  const defaultCoTenantIds = coTenantIdsRaw ? coTenantIdsRaw.split(',').filter(Boolean) : []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: internalUser } = await supabase
    .from('users')
    .select('id, role, legal_entity_id')
    .eq('auth_id', user.id)
    .single()

  if (!internalUser) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single<Tenant>()

  if (!tenant) redirect('/tenants')

  // Must be verified before a PRT can be created
  if (!tenant.right_to_rent_verified) redirect(`/tenants/${id}`)

  // Fetch properties accessible to this user
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('id, address_line_1, address_line_2, city, postcode, is_hmo, hmo_licence_number, hmo_licence_expiry, has_gas, legal_entity_id')
    .in('status', ['available', 'occupied'])
    .order('address_line_1')

  const properties = (propertiesData ?? []) as Pick<Property,
    'id' | 'address_line_1' | 'address_line_2' | 'city' | 'postcode' |
    'is_hmo' | 'hmo_licence_number' | 'hmo_licence_expiry' | 'has_gas' | 'legal_entity_id'
  >[]

  // Co-tenants always scoped to the lead tenant's own legal entity on this path
  const { data: coTenantData } = tenant.legal_entity_id
    ? await supabase
        .from('tenants')
        .select('id, first_name, last_name, email')
        .in('status', ['prospective', 'closed'])
        .eq('right_to_rent_verified', true)
        .eq('legal_entity_id', tenant.legal_entity_id)
        .neq('id', id)
        .order('last_name')
    : { data: [] }

  const availableCoTenants: CoTenantOption[] = (coTenantData ?? []) as CoTenantOption[]

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/tenants/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> {tenant.first_name} {tenant.last_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Create Private Residential Tenancy</h1>
        <p className="mt-1 text-sm text-gray-500">
          Scotland only — Private Housing (Tenancies) (Scotland) Act 2016. No fixed end date.
        </p>
      </div>

      <CreateTenancyForm
        tenantId={tenant.id}
        tenantName={`${tenant.first_name} ${tenant.last_name}`}
        tenantEmail={tenant.email}
        internalUserId={internalUser.id}
        properties={properties}
        availableCoTenants={availableCoTenants}
        defaultPropertyId={defaultPropertyId}
        defaultCoTenantIds={defaultCoTenantIds}
      />
    </div>
  )
}
