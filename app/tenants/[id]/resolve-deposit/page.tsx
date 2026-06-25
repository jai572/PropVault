import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ResolveDepositForm from './ResolveDepositForm'
import type { Tenant } from '@/types'

export default async function ResolveDepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single<Tenant>()

  if (!tenant)                     notFound()
  if (tenant.status !== 'closed')  redirect(`/tenants/${id}`)

  // Fetch the closed tenancy that still has a pending deposit
  const { data: ttRow } = await supabase
    .from('tenancy_tenants')
    .select(`
      tenancy_id,
      tenancies!inner (
        id, tenancy_reference, status, deposit_amount, deposit_scheme, deposit_status
      )
    `)
    .eq('tenant_id', id)
    .eq('tenancies.status', 'closed')
    .eq('tenancies.deposit_status', 'pending')
    .limit(1)
    .single()

  if (!ttRow) redirect(`/tenants/${id}`)

  const tenancy = ttRow.tenancies as unknown as {
    id: string; tenancy_reference: string; status: string
    deposit_amount: number | null; deposit_scheme: string | null; deposit_status: string
  }

  // No deposit held — nothing to resolve
  if (!tenancy.deposit_amount || tenancy.deposit_amount <= 0) redirect(`/tenants/${id}`)

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/tenants/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> {tenant.first_name} {tenant.last_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Resolve Deposit</h1>
        <p className="mt-1 text-sm text-gray-500">
          {tenancy.tenancy_reference} · record the outcome of the deposit held
        </p>
      </div>

      <ResolveDepositForm
        tenantId={tenant.id}
        tenancyId={tenancy.id}
        tenancyReference={tenancy.tenancy_reference}
        depositAmount={tenancy.deposit_amount}
        depositScheme={tenancy.deposit_scheme}
      />
    </div>
  )
}
