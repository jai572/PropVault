import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ComplianceCard } from '@/components/ui/ComplianceCard'
import type { Property, LegalEntity } from '@/types'

type PropertyWithEntity = Property & {
  legal_entities: Pick<LegalEntity, 'name' | 'type'>
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

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: property } = await supabase
    .from('properties')
    .select('*, legal_entities(name, type)')
    .eq('id', id)
    .single<PropertyWithEntity>()

  if (!property) notFound()

  const fullAddress = [
    property.address_line_1,
    property.address_line_2,
    property.city,
    property.postcode,
  ].filter(Boolean).join(', ')

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> All properties
      </Link>

      {/* Property header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {[property.address_line_1, property.address_line_2].filter(Boolean).join(', ')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{property.city}, {property.postcode}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {property.is_hmo && <Badge label="HMO" variant="purple" />}
          <Badge label={property.status} variant={statusVariant(property.status)} />
        </div>
      </div>

      {/* Property details */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Legal entity</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{property.legal_entities.name}</p>
            <p className="text-xs text-gray-400 capitalize">{property.legal_entities.type}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Type</p>
            <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{property.property_type ?? '—'}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Bedrooms</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{property.bedrooms ?? '—'}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Full address</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{fullAddress}</p>
          </div>
        </div>

        {property.is_hmo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            <div className="px-6 py-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">HMO licence number</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{property.hmo_licence_number ?? 'Not recorded'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Compliance certificates */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Compliance certificates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplianceCard title="Gas Safety Certificate" expiry={property.gas_safety_expiry} />
          <ComplianceCard title="EICR" expiry={property.eicr_expiry} />
          <ComplianceCard title="EPC" expiry={property.epc_expiry} />
          {property.is_hmo && (
            <ComplianceCard title="HMO Licence" expiry={property.hmo_licence_expiry} />
          )}
        </div>
      </div>
    </div>
  )
}
