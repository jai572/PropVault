import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import CloseTenancyForm from './CloseTenancyForm'
import type { Tenant } from '@/types'

export default async function CloseTenancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single<Tenant>()

  if (!tenant)                      notFound()
  if (tenant.status !== 'active')   redirect(`/tenants/${id}`)

  // Fetch the active tenancy for this tenant
  const { data: ttRow } = await supabase
    .from('tenancy_tenants')
    .select(`
      tenancy_id,
      tenancies!inner (
        id, tenancy_reference, status, property_id,
        properties!inner ( id, address_line_1, address_line_2, city, postcode )
      )
    `)
    .eq('tenant_id', id)
    .eq('tenancies.status', 'active')
    .limit(1)
    .single()

  if (!ttRow) redirect(`/tenants/${id}`)

  const tenancy  = ttRow.tenancies as unknown as {
    id: string; tenancy_reference: string; status: string; property_id: string
    properties: { id: string; address_line_1: string; address_line_2: string | null; city: string; postcode: string }
  }
  const property = tenancy.properties
  const propertyAddress = [property.address_line_1, property.address_line_2, property.city, property.postcode]
    .filter(Boolean).join(', ')

  const todayISO = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/tenants/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> {tenant.first_name} {tenant.last_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Close Tenancy</h1>
        <p className="mt-1 text-sm text-gray-500">
          {tenancy.tenancy_reference} · {propertyAddress}
        </p>
      </div>

      <CloseTenancyForm
        tenantId={tenant.id}
        tenantName={`${tenant.first_name} ${tenant.last_name}`}
        tenancyId={tenancy.id}
        tenancyReference={tenancy.tenancy_reference}
        propertyId={property.id}
        propertyAddress={propertyAddress}
        todayISO={todayISO}
      />
    </div>
  )
}
