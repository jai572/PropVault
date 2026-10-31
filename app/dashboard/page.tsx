import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getComplianceStatus, daysUntilExpiry } from '@/lib/utils/compliance'
import type { Property } from '@/types'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatGBP(n: number) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

function formatAddress(p: { address_line_1: string; address_line_2: string | null; city: string }) {
  return [p.address_line_1, p.address_line_2, p.city].filter(Boolean).join(', ')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usersRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const { data: entityLinks } = await supabase
    .from('user_legal_entities')
    .select('legal_entity_id')
    .eq('user_id', usersRow?.id ?? '')

  const legalEntityIds = (entityLinks ?? []).map((e) => e.legal_entity_id as string)

  if (legalEntityIds.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        {usersRow?.role === 'super_admin' && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-sm text-gray-600">
            You are signed in as <span className="font-medium">super_admin</span>. Use the{' '}
            <a href="/admin" className="font-medium text-gray-900 underline underline-offset-2">Admin panel</a>{' '}
            to browse any landlord&apos;s portfolio.
          </div>
        )}
      </div>
    )
  }

  // Mark overdue rent records before querying
  await supabase.rpc('mark_overdue_rent_records').then(
    ({ error }) => { if (error) console.error('[dashboard] mark_overdue:', error.message) }
  )

  const [
    { data: properties },
    { data: activeTenancies },
    { data: overdueRent },
    { data: pendingReminders },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('id, address_line_1, address_line_2, city, postcode, jurisdiction, has_gas, epc_expiry, gas_safety_expiry, eicr_expiry, is_hmo, hmo_licence_expiry, legal_entity_id')
      .in('legal_entity_id', legalEntityIds),
    supabase
      .from('tenancies')
      .select('id, property_id, rent_amount, rent_due_day, jurisdiction')
      .in('property_id', []) // placeholder — filled below after properties loaded
      .eq('status', 'active'),
    supabase
      .from('rent_records')
      .select('id, tenancy_id, due_date, amount_due, amount_paid')
      .eq('status', 'overdue'),
    supabase
      .from('reminders')
      .select('id, property_id, type, due_date, status')
      .eq('status', 'pending')
      .order('due_date', { ascending: true }),
  ])

  const propertyList = properties ?? []
  const propertyIds = propertyList.map(p => p.id)

  // Fetch active tenancies for all properties in one query
  const { data: tenancyRows } = await supabase
    .from('tenancies')
    .select('id, property_id, rent_amount, jurisdiction')
    .in('property_id', propertyIds.length > 0 ? propertyIds : ['_none_'])
    .eq('status', 'active')

  const tenancyList = tenancyRows ?? []
  const tenancyIds = tenancyList.map(t => t.id as string)

  // Fetch overdue rent records for these tenancies
  const { data: overdueRows } = await supabase
    .from('rent_records')
    .select('id, tenancy_id, due_date, amount_due, amount_paid')
    .in('tenancy_id', tenancyIds.length > 0 ? tenancyIds : ['_none_'])
    .eq('status', 'overdue')
    .order('due_date', { ascending: true })

  const overdueList = overdueRows ?? []

  // Map tenancy_id → property_id
  const tenancyToProperty = new Map(tenancyList.map(t => [t.id as string, t.property_id as string]))
  const propertyById = new Map(propertyList.map(p => [p.id, p]))

  // Build compliance alerts from properties
  type ComplianceAlert = {
    propertyId: string
    address: string
    certName: string
    expiry: string | null
    status: 'expired' | 'expiring_soon'
    days: number | null
  }

  const complianceAlerts: ComplianceAlert[] = []
  for (const p of propertyList) {
    const checks: { name: string; expiry: string | null }[] = [
      { name: 'EPC', expiry: p.epc_expiry },
      { name: 'EICR', expiry: p.eicr_expiry },
      ...(p.has_gas ? [{ name: 'Gas Safety', expiry: p.gas_safety_expiry }] : []),
      ...(p.is_hmo ? [{ name: 'HMO Licence', expiry: (p as any).hmo_licence_expiry }] : []),
    ]
    for (const c of checks) {
      const s = getComplianceStatus(c.expiry)
      if (s === 'expired' || s === 'expiring_soon') {
        complianceAlerts.push({
          propertyId: p.id,
          address: formatAddress(p),
          certName: c.name,
          expiry: c.expiry,
          status: s,
          days: daysUntilExpiry(c.expiry),
        })
      }
    }
  }
  // Sort: expired first, then soonest expiry
  complianceAlerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'expired' ? -1 : 1
    return (a.days ?? 0) - (b.days ?? 0)
  })

  // Right to Rent: England tenancies only
  const englandTenancyIds = new Set(
    tenancyList.filter(t => (t.jurisdiction ?? 'scotland') === 'england_wales').map(t => t.id as string)
  )
  let rtrAlerts: { tenantId: string; name: string; propertyId: string; address: string }[] = []
  if (englandTenancyIds.size > 0) {
    const { data: rtrTenants } = await supabase
      .from('tenancy_tenants')
      .select('tenant_id, tenancy_id, tenants(id, first_name, last_name, right_to_rent_verified)')
      .in('tenancy_id', [...englandTenancyIds])

    for (const row of rtrTenants ?? []) {
      const tenant = (row as any).tenants
      if (tenant && !tenant.right_to_rent_verified) {
        const propId = tenancyToProperty.get(row.tenancy_id as string) ?? ''
        const prop = propertyById.get(propId)
        rtrAlerts.push({
          tenantId: tenant.id,
          name: `${tenant.first_name} ${tenant.last_name}`,
          propertyId: propId,
          address: prop ? formatAddress(prop) : '',
        })
      }
    }
  }

  const totalActions = overdueList.length + complianceAlerts.length + rtrAlerts.length

  // Properties with no active tenancy
  const occupiedPropertyIds = new Set(tenancyList.map(t => t.property_id as string))
  const vacantProperties = propertyList.filter(p => !occupiedPropertyIds.has(p.id))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalActions > 0
              ? `${totalActions} item${totalActions === 1 ? '' : 's'} need${totalActions === 1 ? 's' : ''} attention`
              : 'All clear — no actions needed'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/properties/new"
            className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            + Add property
          </Link>
        </div>
      </div>

      {/* ── Overdue rent ───────────────────────────────────────────────── */}
      {overdueList.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3">
            Overdue rent · {overdueList.length}
          </h2>
          <div className="bg-white rounded-xl border border-red-200 divide-y divide-gray-100 overflow-hidden">
            {overdueList.map((r) => {
              const propId = tenancyToProperty.get(r.tenancy_id as string) ?? ''
              const prop = propertyById.get(propId)
              const daysOverdue = prop
                ? Math.floor((Date.now() - new Date(r.due_date as string).getTime()) / 86400000)
                : 0
              return (
                <div key={r.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {prop ? formatAddress(prop) : 'Unknown property'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Due {formatDate(r.due_date as string)} · {formatGBP(Number(r.amount_due))}
                      {Number(r.amount_paid) > 0 && ` (${formatGBP(Number(r.amount_paid))} paid)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-medium text-red-700 bg-red-50 rounded-full px-2.5 py-1">
                      {daysOverdue}d overdue
                    </span>
                    {prop && (
                      <Link
                        href={`/properties/${propId}`}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2"
                      >
                        Record →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Compliance alerts ──────────────────────────────────────────── */}
      {complianceAlerts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">
            Compliance · {complianceAlerts.length}
          </h2>
          <div className="bg-white rounded-xl border border-amber-200 divide-y divide-gray-100 overflow-hidden">
            {complianceAlerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.address}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.certName} · {a.expiry ? formatDate(a.expiry) : 'Not recorded'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                    a.status === 'expired'
                      ? 'text-red-700 bg-red-50'
                      : 'text-amber-700 bg-amber-50'
                  }`}>
                    {a.status === 'expired'
                      ? `Expired ${Math.abs(a.days ?? 0)}d ago`
                      : `${a.days}d left`}
                  </span>
                  <Link
                    href={`/properties/${a.propertyId}`}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Right to Rent (England only) ───────────────────────────────── */}
      {rtrAlerts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-3">
            Right to Rent · {rtrAlerts.length}
          </h2>
          <div className="bg-white rounded-xl border border-purple-200 divide-y divide-gray-100 overflow-hidden">
            {rtrAlerts.map((a) => (
              <div key={a.tenantId} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.address}</p>
                </div>
                <Link
                  href={`/tenants/${a.tenantId}`}
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 flex-shrink-0"
                >
                  Verify →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All clear */}
      {totalActions === 0 && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-6 py-8 text-center">
          <p className="text-sm font-medium text-green-800">All clear</p>
          <p className="text-xs text-green-600 mt-1">No overdue rent, expiring certificates, or outstanding checks.</p>
        </div>
      )}

      {/* ── Portfolio overview ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Portfolio</h2>
          <Link href="/dashboard/properties" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            All properties →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total properties', value: propertyList.length },
            { label: 'Occupied', value: occupiedPropertyIds.size },
            { label: 'Vacant', value: vacantProperties.length },
            { label: 'Overdue rent', value: overdueList.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vacant properties quick-links */}
      {vacantProperties.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vacant properties</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {vacantProperties.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <p className="text-sm text-gray-900 truncate">{formatAddress(p)}, {p.postcode}</p>
                <Link
                  href={`/properties/${p.id}/create-tenancy`}
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 flex-shrink-0"
                >
                  Create tenancy →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
