import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { Property, LegalEntity } from '@/types'

type PropertyWithEntity = Property & {
  legal_entities: Pick<LegalEntity, 'name'>
}

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'

function statusVariant(status: Property['status']): BadgeVariant {
  switch (status) {
    case 'available':   return 'green'
    case 'occupied':    return 'blue'
    case 'maintenance': return 'yellow'
    case 'asset':       return 'gray'
  }
}

function formatAddress(property: Property): string {
  return [property.address_line_1, property.address_line_2].filter(Boolean).join(', ')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve the current user's own row and their legal entity links.
  // Super_admin with no entity links sees an empty portfolio here;
  // portfolio browsing for other landlords is done via /admin.
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
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
          <p className="mt-1 text-sm text-gray-500">No portfolio linked to this account.</p>
        </div>
        {usersRow?.role === 'super_admin' && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-sm text-gray-600">
            You are signed in as <span className="font-medium">super_admin</span>. Use the{' '}
            <a href="/admin" className="font-medium text-gray-900 underline underline-offset-2">
              Admin panel
            </a>{' '}
            to browse any landlord&apos;s portfolio by User ID or Legal Entity ID.
          </div>
        )}
      </div>
    )
  }

  const [
    { data: properties, error },
    { data: allTenancies },
    { data: openComms },
    { data: openMaint },
    { data: openViewing },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('*, legal_entities(name)')
      .in('legal_entity_id', legalEntityIds)
      .order('legal_entity_id')
      .returns<PropertyWithEntity[]>(),
    supabase.from('tenancies').select('id, property_id'),
    supabase.from('communications').select('tenancy_id').in('status', ['open', 'in_progress']),
    supabase.from('maintenance_jobs').select('property_id').in('status', ['reported', 'assigned']),
    supabase.from('viewing_jobs').select('property_id').in('status', ['assigned', 'confirmed']),
  ])

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load properties. Please refresh.
      </div>
    )
  }

  // Build indicator sets keyed by property_id
  const tenancyToProperty = new Map(
    (allTenancies ?? []).map(t => [t.id as string, t.property_id as string])
  )
  const commDot = new Set<string>()
  for (const c of openComms ?? []) {
    const propId = tenancyToProperty.get(c.tenancy_id as string)
    if (propId) commDot.add(propId)
  }
  const maintDot = new Set((openMaint ?? []).map(m => m.property_id as string))
  const viewingDot = new Set((openViewing ?? []).map(v => v.property_id as string))

  const grouped = (properties ?? []).reduce<Record<string, PropertyWithEntity[]>>(
    (acc, property) => {
      const entityName = property.legal_entities?.name ?? 'Unknown'
      if (!acc[entityName]) acc[entityName] = []
      acc[entityName].push(property)
      return acc
    },
    {}
  )

  const totalProperties = properties?.length ?? 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalProperties} {totalProperties === 1 ? 'property' : 'properties'} across all entities
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(grouped).map(([entityName, entityProperties]) => (
          <section key={entityName}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              {entityName} — {entityProperties.length} {entityProperties.length === 1 ? 'property' : 'properties'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entityProperties.map((property) => {
                const hasComm    = commDot.has(property.id)
                const hasMaint   = maintDot.has(property.id)
                const hasViewing = viewingDot.has(property.id)

                return (
                  <Link
                    key={property.id}
                    href={`/properties/${property.id}`}
                    className="group block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 truncate">
                          {formatAddress(property)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{property.city} · {property.postcode}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {property.is_hmo && <Badge label="HMO" variant="purple" />}
                        <Badge label={property.status} variant={statusVariant(property.status)} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {property.property_type && (
                          <span className="capitalize">{property.property_type}</span>
                        )}
                        {property.bedrooms != null && (
                          <span>{property.bedrooms} bed</span>
                        )}
                      </div>
                      {(hasComm || hasMaint || hasViewing) && (
                        <div className="flex items-center gap-1.5">
                          {hasComm && (
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0"
                              title="Open communications"
                            />
                          )}
                          {hasMaint && (
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-amber-400 flex-shrink-0"
                              title="Open maintenance jobs"
                            />
                          )}
                          {hasViewing && (
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-violet-500 flex-shrink-0"
                              title="Open viewing jobs"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {totalProperties === 0 && (
        <div className="text-center py-16 text-sm text-gray-400">No properties found.</div>
      )}
    </div>
  )
}
