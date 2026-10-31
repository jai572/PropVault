import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getComplianceStatus, daysUntilExpiry, formatExpiryDate } from '@/lib/utils/compliance'
import RentLedgerInline from './RentLedgerInline'

type RentRow = {
  id: string
  tenancy_id: string
  due_date: string
  amount_due: number
  amount_paid: number | null
  paid_date: string | null
  status: 'pending' | 'paid' | 'partial' | 'overdue'
  notes: string | null
  tenancy_reference: string
  property_address: string
  property_id: string
}

type ComplianceRow = {
  propertyId: string
  address: string
  city: string
  postcode: string
  epcExpiry: string | null
  eicrExpiry: string | null
  gasSafetyExpiry: string | null
  hasGas: boolean
  isHmo: boolean
  hmoLicenceExpiry: string | null
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatGBP(n: number) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

const STATUS_STYLE: Record<string, string> = {
  paid:    'bg-green-50 text-green-700',
  partial: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  pending: 'bg-gray-100 text-gray-500',
}

const COMPLIANCE_STATUS_STYLE = {
  expired:       'bg-red-50 border-red-200 text-red-700',
  expiring_soon: 'bg-amber-50 border-amber-200 text-amber-700',
  valid:         'bg-green-50 border-green-200 text-green-700',
  not_set:       'bg-gray-50 border-gray-200 text-gray-500',
}

export default async function RentCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'compliance' ? 'compliance' : 'rent'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.rpc('mark_overdue_rent_records').then(
    ({ error }) => { if (error) console.error('[rent page] mark_overdue:', error.message) }
  )

  const { data: internalUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  if (!internalUser) redirect('/login')

  const { data: entityLinks } = await supabase
    .from('user_legal_entities')
    .select('legal_entity_id')
    .eq('user_id', internalUser.id)

  const legalEntityIds = (entityLinks ?? []).map(e => e.legal_entity_id as string)

  if (legalEntityIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Rent &amp; Compliance</h1>
        <p className="text-sm text-gray-400">No portfolio linked to this account.</p>
      </div>
    )
  }

  // Fetch all properties
  const { data: propertiesRaw } = await supabase
    .from('properties')
    .select('id, address_line_1, address_line_2, city, postcode, has_gas, is_hmo, epc_expiry, eicr_expiry, gas_safety_expiry, hmo_licence_expiry')
    .in('legal_entity_id', legalEntityIds)

  const properties = propertiesRaw ?? []
  const propertyIds = properties.map(p => p.id as string)

  // Fetch active tenancies
  const { data: tenanciesRaw } = await supabase
    .from('tenancies')
    .select('id, property_id, tenancy_reference')
    .in('property_id', propertyIds.length > 0 ? propertyIds : ['_none_'])
    .eq('status', 'active')

  const tenancies = tenanciesRaw ?? []
  const tenancyIds = tenancies.map(t => t.id as string)

  // Build property lookup
  const propertyById = new Map(properties.map(p => [
    p.id as string,
    {
      address: [p.address_line_1, p.address_line_2].filter(Boolean).join(', '),
      city: p.city as string,
      postcode: p.postcode as string,
      id: p.id as string,
    }
  ]))
  const tenancyToProperty = new Map(tenancies.map(t => [t.id as string, t.property_id as string]))
  const tenancyRef = new Map(tenancies.map(t => [t.id as string, t.tenancy_reference as string]))

  // Fetch ALL rent records for active tenancies (not just overdue)
  const { data: rentRecordsRaw } = tenancyIds.length > 0
    ? await supabase
        .from('rent_records')
        .select('id, tenancy_id, due_date, amount_due, amount_paid, paid_date, status, notes')
        .in('tenancy_id', tenancyIds)
        .order('due_date', { ascending: false })
    : { data: [] }

  const rentRows: RentRow[] = (rentRecordsRaw ?? []).map((r: Record<string, unknown>) => {
    const propId = tenancyToProperty.get(r.tenancy_id as string) ?? ''
    const prop = propertyById.get(propId)
    return {
      id: r.id as string,
      tenancy_id: r.tenancy_id as string,
      due_date: r.due_date as string,
      amount_due: Number(r.amount_due),
      amount_paid: r.amount_paid != null ? Number(r.amount_paid) : null,
      paid_date: r.paid_date as string | null,
      status: r.status as RentRow['status'],
      notes: r.notes as string | null,
      tenancy_reference: tenancyRef.get(r.tenancy_id as string) ?? '',
      property_address: prop ? `${prop.address}, ${prop.city}` : 'Unknown',
      property_id: propId,
    }
  })

  // Build compliance rows
  const complianceRows: ComplianceRow[] = properties.map(p => ({
    propertyId:       p.id as string,
    address:          [p.address_line_1, p.address_line_2].filter(Boolean).join(', ') as string,
    city:             p.city as string,
    postcode:         p.postcode as string,
    epcExpiry:        p.epc_expiry as string | null,
    eicrExpiry:       p.eicr_expiry as string | null,
    gasSafetyExpiry:  p.gas_safety_expiry as string | null,
    hasGas:           p.has_gas as boolean,
    isHmo:            p.is_hmo as boolean,
    hmoLicenceExpiry: (p as any).hmo_licence_expiry as string | null,
  }))

  const overdueCount = rentRows.filter(r => r.status === 'overdue').length
  const expiredCount = complianceRows.reduce((n, p) => {
    const checks = [p.epcExpiry, p.eicrExpiry, ...(p.hasGas ? [p.gasSafetyExpiry] : []), ...(p.isHmo ? [p.hmoLicenceExpiry] : [])]
    return n + checks.filter(e => getComplianceStatus(e) === 'expired' || getComplianceStatus(e) === 'expiring_soon').length
  }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Rent &amp; Compliance</h1>
        <p className="mt-1 text-sm text-gray-500">Track payments and certificate status across all properties.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <Link
          href="/rent"
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'rent'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Rent ledger
          {overdueCount > 0 && (
            <span className="ml-2 rounded-full bg-red-100 text-red-700 text-xs px-1.5 py-0.5">{overdueCount}</span>
          )}
        </Link>
        <Link
          href="/rent?tab=compliance"
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'compliance'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Compliance
          {expiredCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5">{expiredCount}</span>
          )}
        </Link>
      </div>

      {/* ── Rent tab ── */}
      {activeTab === 'rent' && (
        <div className="space-y-4">
          {rentRows.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No rent records found. Create a tenancy to start tracking rent.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['overdue', 'pending', 'partial', 'paid'] as const).map(s => {
                  const count = rentRows.filter(r => r.status === s).length
                  return (
                    <div key={s} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                      <p className="text-lg font-semibold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{s}</p>
                    </div>
                  )
                })}
              </div>

              {/* Ledger table */}
              <RentLedgerInline records={rentRows} />
            </>
          )}
        </div>
      )}

      {/* ── Compliance tab ── */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          {complianceRows.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No properties found.</p>
          ) : (
            complianceRows.map(p => {
              const certs: { name: string; expiry: string | null }[] = [
                { name: 'EPC', expiry: p.epcExpiry },
                { name: 'EICR', expiry: p.eicrExpiry },
                ...(p.hasGas ? [{ name: 'Gas Safety', expiry: p.gasSafetyExpiry }] : []),
                ...(p.isHmo ? [{ name: 'HMO Licence', expiry: p.hmoLicenceExpiry }] : []),
              ]
              return (
                <div key={p.propertyId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.address}</p>
                      <p className="text-xs text-gray-500">{p.city}, {p.postcode}</p>
                    </div>
                    <Link
                      href={`/properties/${p.propertyId}`}
                      className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2"
                    >
                      Edit →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
                    {certs.map(c => {
                      const status = getComplianceStatus(c.expiry)
                      const days   = daysUntilExpiry(c.expiry)
                      const style  = COMPLIANCE_STATUS_STYLE[status]
                      return (
                        <div key={c.name} className={`px-4 py-3 ${style}`}>
                          <p className="text-xs font-medium">{c.name}</p>
                          <p className="text-xs mt-1 opacity-80">{formatExpiryDate(c.expiry)}</p>
                          {status === 'expired' && days !== null && (
                            <p className="text-xs mt-0.5 font-medium">{Math.abs(days)}d overdue</p>
                          )}
                          {status === 'expiring_soon' && days !== null && (
                            <p className="text-xs mt-0.5 font-medium">{days}d left</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
