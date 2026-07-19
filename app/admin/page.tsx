import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type SearchParams = Promise<{ email?: string; entityName?: string }>

// ── Types ─────────────────────────────────────────────────────────────────────

type LegalEntityRow = { id: string; name: string }
type UsersRow = { id: string; name: string; email: string; role: string; legal_entity_id: string | null }
type PropertyRow = { id: string; address_line_1: string; address_line_2: string | null; city: string; postcode: string; status: string; legal_entities: { name: string } | null }
type TenancyRow = { id: string; tenancy_reference: string; status: string; start_date: string; rent_amount: number; properties: { address_line_1: string } | null }
type TenantRow = { id: string; first_name: string; last_name: string; email: string; status: string }

type AdminSearchResult = {
  legalEntity: LegalEntityRow | null
  landlord: UsersRow | null
  properties: PropertyRow[]
  tenancies: TenancyRow[]
  tenants: TenantRow[]
}

// ── Helper ────────────────────────────────────────────────────────────────────

function formatAddress(p: PropertyRow) {
  return [p.address_line_1, p.address_line_2].filter(Boolean).join(', ')
}

function formatGBP(n: number) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

const STATUS_PILL: Record<string, string> = {
  active:      'bg-green-50 text-green-700',
  available:   'bg-green-50 text-green-700',
  occupied:    'bg-blue-50 text-blue-700',
  closed:      'bg-gray-100 text-gray-500',
  maintenance: 'bg-amber-50 text-amber-700',
  asset:       'bg-gray-100 text-gray-500',
  inactive:    'bg-gray-100 text-gray-500',
}

function Pill({ label }: { label: string }) {
  const cls = STATUS_PILL[label] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default async function AdminPage(props: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usersRow } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (usersRow?.role !== 'super_admin') redirect('/dashboard')

  const { email, entityName } = await props.searchParams
  const hasSearch = !!(email?.trim() || entityName?.trim())

  let result: AdminSearchResult | null = null
  let searchError: string | null = null

  if (hasSearch) {
    // Resolve matching legal entities by partial name match
    let matchedEntities: LegalEntityRow[] = []
    if (entityName?.trim()) {
      const { data } = await supabase
        .from('legal_entities')
        .select('id, name')
        .ilike('name', `%${entityName.trim()}%`)
      matchedEntities = data ?? []
    }
    const legalEntity: LegalEntityRow | null = matchedEntities[0] ?? null

    // Resolve the landlord user row by email (exact match)
    let landlord: UsersRow | null = null
    if (email?.trim()) {
      const { data } = await supabase
        .from('users')
        .select('id, name, email, role, legal_entity_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      landlord = data ?? null
      // If no entity name given, use the landlord's primary legal entity
      if (!legalEntity && landlord?.legal_entity_id) {
        const { data: le } = await supabase
          .from('legal_entities')
          .select('id, name')
          .eq('id', landlord.legal_entity_id)
          .maybeSingle()
        if (le) matchedEntities = [le]
      }
    }

    if (!legalEntity && matchedEntities.length === 0 && !landlord) {
      searchError = 'No matching landlord or legal entity found. Check the email or entity name and try again.'
    } else {
      // Determine which entity IDs to scope the property search to.
      // If a landlord is found, also include all entities linked via user_legal_entities.
      let entityIds: string[] = matchedEntities.map((e) => e.id)
      if (landlord) {
        const { data: uleRows } = await supabase
          .from('user_legal_entities')
          .select('legal_entity_id')
          .eq('user_id', landlord.id)
        const extraIds = (uleRows ?? []).map((r) => r.legal_entity_id as string)
        entityIds = [...new Set([...entityIds, ...extraIds])]
        if (landlord.legal_entity_id && !entityIds.includes(landlord.legal_entity_id)) {
          entityIds.push(landlord.legal_entity_id)
        }
      }

      const [
        { data: properties },
        { data: tenancies },
        { data: tenants },
      ] = await Promise.all([
        entityIds.length > 0
          ? supabase
              .from('properties')
              .select('id, address_line_1, address_line_2, city, postcode, status, legal_entities(name)')
              .in('legal_entity_id', entityIds)
              .order('address_line_1')
              .returns<PropertyRow[]>()
          : Promise.resolve({ data: [] as PropertyRow[], error: null }),
        entityIds.length > 0
          ? supabase
              .from('tenancies')
              .select('id, tenancy_reference, status, start_date, rent_amount, properties(address_line_1)')
              .in('property_id',
                // sub-select via property list — pass IDs we already fetched
                entityIds.length > 0
                  ? (await supabase.from('properties').select('id').in('legal_entity_id', entityIds)).data?.map((p) => p.id) ?? []
                  : []
              )
              .order('start_date', { ascending: false })
              .returns<TenancyRow[]>()
          : Promise.resolve({ data: [] as TenancyRow[], error: null }),
        entityIds.length > 0
          ? supabase
              .from('tenants')
              .select('id, first_name, last_name, email, status')
              .in('id',
                (await supabase
                  .from('tenancy_tenants')
                  .select('tenant_id')
                  .in('tenancy_id',
                    (await supabase.from('tenancies').select('id').in('property_id',
                      (await supabase.from('properties').select('id').in('legal_entity_id', entityIds)).data?.map(p => p.id) ?? []
                    )).data?.map(t => t.id) ?? []
                  )
                ).data?.map(tt => tt.tenant_id) ?? []
              )
              .order('last_name')
              .returns<TenantRow[]>()
          : Promise.resolve({ data: [] as TenantRow[], error: null }),
      ])

      result = {
        legalEntity: matchedEntities[0] ?? null,
        landlord,
        properties: properties ?? [],
        tenancies: tenancies ?? [],
        tenants: tenants ?? [],
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only view of any landlord&apos;s portfolio. No edits can be made from here.
        </p>
      </div>

      {/* Search form */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Search by landlord</h2>
        <p className="text-xs text-gray-500">Fill in one or both fields. Both are combined when provided.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Landlord email address</label>
            <input
              type="email"
              name="email"
              defaultValue={email ?? ''}
              placeholder="e.g. landlord@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Legal entity name (partial match)</label>
            <input
              type="text"
              name="entityName"
              defaultValue={entityName ?? ''}
              placeholder="e.g. Bhalani or TJ Property"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Search
          </button>
          {hasSearch && (
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Error */}
      {searchError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {searchError}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-5 py-4 text-sm text-gray-700 space-y-1">
            {result.landlord && (
              <p>
                <span className="font-medium">Landlord:</span> {result.landlord.name} ({result.landlord.email}) ·{' '}
                <span className="capitalize">{result.landlord.role?.replace('_', ' ')}</span>
              </p>
            )}
            {result.legalEntity && (
              <p>
                <span className="font-medium">Legal entity:</span> {result.legalEntity.name}
              </p>
            )}
            <p className="text-gray-500">
              {result.properties.length} {result.properties.length === 1 ? 'property' : 'properties'} ·{' '}
              {result.tenancies.length} {result.tenancies.length === 1 ? 'tenancy' : 'tenancies'} ·{' '}
              {result.tenants.length} {result.tenants.length === 1 ? 'tenant' : 'tenants'}
            </p>
          </div>

          {/* Properties */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Properties</h2>
            {result.properties.length === 0 ? (
              <p className="text-sm text-gray-400">No properties found.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {result.properties.map((p) => (
                    <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{formatAddress(p)}</p>
                        <p className="text-xs text-gray-400">{p.city} · {p.postcode}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {p.legal_entities?.name && (
                          <span className="hidden sm:inline text-xs text-gray-400">{p.legal_entities.name}</span>
                        )}
                        <Pill label={p.status} />
                        <Link
                          href={`/properties/${p.id}`}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Tenancies */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tenancies</h2>
            {result.tenancies.length === 0 ? (
              <p className="text-sm text-gray-400">No tenancies found.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="hidden sm:grid grid-cols-[1fr_1fr_100px_80px] gap-4 px-5 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Property</span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rent</span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {result.tenancies.map((t) => (
                    <div key={t.id} className="px-5 py-3 sm:grid sm:grid-cols-[1fr_1fr_100px_80px] sm:gap-4 sm:items-center space-y-1 sm:space-y-0">
                      <span className="text-sm font-mono text-gray-900">{t.tenancy_reference}</span>
                      <span className="text-sm text-gray-600 truncate">
                        {(t.properties as unknown as { address_line_1: string } | null)?.address_line_1 ?? '—'}
                      </span>
                      <span className="text-sm text-gray-900">{formatGBP(t.rent_amount)}</span>
                      <Pill label={t.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Tenants */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tenants</h2>
            {result.tenants.length === 0 ? (
              <p className="text-sm text-gray-400">No tenants found.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {result.tenants.map((t) => (
                    <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {t.first_name} {t.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{t.email}</p>
                      </div>
                      <Pill label={t.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
