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
    case 'available': return 'green'
    case 'occupied': return 'blue'
    case 'maintenance': return 'yellow'
    case 'asset': return 'gray'
  }
}

function formatAddress(property: Property): string {
  return [property.address_line_1, property.address_line_2]
    .filter(Boolean)
    .join(', ')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: properties, error } = await supabase
    .from('properties')
    .select('*, legal_entities(name)')
    .order('legal_entity_id')
    .returns<PropertyWithEntity[]>()

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load properties. Please refresh.
      </div>
    )
  }

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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
          <p className="mt-1 text-sm text-gray-500">{totalProperties} properties across all entities</p>
        </div>
      </div>

      {/* Property list grouped by legal entity */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([entityName, entityProperties]) => (
          <section key={entityName}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {entityName} — {entityProperties.length} {entityProperties.length === 1 ? 'property' : 'properties'}
            </h2>

            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beds</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HMO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entityProperties.map((property) => (
                    <tr key={property.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <Link href={`/properties/${property.id}`} className="block">
                          <div className="text-sm font-medium text-gray-900 hover:text-gray-600">{formatAddress(property)}</div>
                          <div className="text-xs text-gray-400">{property.city} · {property.postcode}</div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{property.property_type ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{property.bedrooms ?? '—'}</td>
                      <td className="px-6 py-4">
                        {property.is_hmo ? (
                          <Badge label="HMO" variant="purple" />
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge label={property.status} variant={statusVariant(property.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
              {entityProperties.map((property) => (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatAddress(property)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{property.city} · {property.postcode}</p>
                    </div>
                    <Badge label={property.status} variant={statusVariant(property.status)} />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {property.property_type && (
                      <span className="text-xs text-gray-500 capitalize">{property.property_type}</span>
                    )}
                    {property.bedrooms && (
                      <span className="text-xs text-gray-500">{property.bedrooms} bed</span>
                    )}
                    {property.is_hmo && <Badge label="HMO" variant="purple" />}
                  </div>
                </Link>
              ))}
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
