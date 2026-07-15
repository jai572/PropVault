import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

type TenancyRow = {
  id: string
  tenancy_reference: string
  start_date: string
  rent_amount: number
  rent_due_day: number
  deposit_certificate_url: string | null
}

export default async function TenantDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Look up the tenant record for this auth user
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, first_name, last_name')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!tenant) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-gray-900">No active tenancy found for your account.</p>
        <p className="text-sm text-gray-500">
          If you believe this is an error, please contact your landlord.
        </p>
      </div>
    )
  }

  // Find active tenancy via tenancy_tenants
  const { data: ttRow } = await supabase
    .from('tenancy_tenants')
    .select('tenancy_id, tenancies(id, tenancy_reference, start_date, rent_amount, rent_due_day, deposit_certificate_url)')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const tenancy = (ttRow?.tenancies as unknown as TenancyRow | null) ?? null

  if (!tenancy) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Hello, {tenant.first_name}
        </h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No active tenancy found for your account.</p>
        </div>
      </div>
    )
  }

  // PRT document for this tenancy
  const { data: prtDoc } = await supabase
    .from('documents')
    .select('file_url')
    .eq('tenancy_id', tenancy.id)
    .eq('type', 'PRT')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prtViewUrl = prtDoc
    ? `/api/portal/documents/view?bucket=prt-documents&path=${encodeURIComponent(prtDoc.file_url)}`
    : null

  const depositViewUrl = tenancy.deposit_certificate_url
    ? `/api/portal/documents/view?bucket=deposit-certificates&path=${encodeURIComponent(tenancy.deposit_certificate_url)}`
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Hello, {tenant.first_name}</h1>
        <p className="mt-1 text-sm text-gray-500">Tenancy {tenancy.tenancy_reference}</p>
      </div>

      {/* PRT document */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Tenancy agreement
        </h2>
        {prtViewUrl ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Private Residential Tenancy</span>
            <a
              href={prtViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View / download →
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Tenancy agreement not yet available.</p>
        )}
      </section>

      {/* Deposit certificate */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Deposit certificate
        </h2>
        {depositViewUrl ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Deposit protection certificate</span>
            <a
              href={depositViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View / download →
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Deposit certificate not yet available.</p>
        )}
      </section>

      {/* Payment schedule */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Payment schedule
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Tenancy start</span>
            <span className="text-sm font-medium text-gray-900">{formatDate(tenancy.start_date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Monthly rent</span>
            <span className="text-sm font-medium text-gray-900">
              £{Number(tenancy.rent_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Due each month</span>
            <span className="text-sm font-medium text-gray-900">{ordinal(tenancy.rent_due_day)} of the month</span>
          </div>
        </div>
      </section>
    </div>
  )
}
