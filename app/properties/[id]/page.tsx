import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ComplianceCard } from '@/components/ui/ComplianceCard'
import PropertyFacilitiesPanel from './PropertyFacilitiesPanel'
import type { Property, LegalEntity, Reminder, PropertyFacility } from '@/types'

type PropertyWithEntity = Property & {
  legal_entities: Pick<LegalEntity, 'name' | 'type'>
}

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'

const REMINDER_LABELS: Record<Reminder['type'], string> = {
  gas_safety: 'Gas Safety Certificate',
  eicr: 'EICR',
  epc: 'EPC',
  hmo_licence: 'HMO Licence',
  deposit_lodgement: 'Deposit Lodgement',
  council_tax: 'Council Tax',
  right_to_rent: 'Right to Rent',
  rent_due: 'Rent Due',
}

function statusVariant(status: Property['status']): BadgeVariant {
  switch (status) {
    case 'available': return 'green'
    case 'occupied':  return 'blue'
    case 'maintenance': return 'yellow'
    case 'asset':     return 'gray'
  }
}

function reminderVariant(dueDate: string): BadgeVariant {
  const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'red'
  if (days <= 30) return 'yellow'
  return 'gray'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: property }, { data: reminders }, { data: facilitiesData }] = await Promise.all([
    supabase
      .from('properties')
      .select('*, legal_entities(name, type)')
      .eq('id', id)
      .single<PropertyWithEntity>(),
    supabase
      .from('reminders')
      .select('*')
      .eq('property_id', id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .returns<Reminder[]>(),
    supabase
      .from('property_facilities')
      .select('*')
      .eq('property_id', id)
      .order('sort_order', { ascending: true })
      .returns<PropertyFacility[]>(),
  ])

  if (!property) notFound()

  const facilities = facilitiesData ?? []

  const fullAddress = [
    property.address_line_1,
    property.address_line_2,
    property.city,
    property.postcode,
  ].filter(Boolean).join(', ')

  const pendingReminders = reminders ?? []

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
          {property.has_gas && (
            <ComplianceCard title="Gas Safety Certificate" expiry={property.gas_safety_expiry} />
          )}
          <ComplianceCard title="EICR" expiry={property.eicr_expiry} />
          <ComplianceCard title="EPC" expiry={property.epc_expiry} />
          {property.is_hmo && (
            <ComplianceCard title="HMO Licence" expiry={property.hmo_licence_expiry} />
          )}
        </div>
      </div>

      {/* Pending reminders */}
      {pendingReminders.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Pending reminders</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pendingReminders.map((reminder) => {
              const days = Math.floor((new Date(reminder.due_date).getTime() - Date.now()) / 86400000)
              const overdue = days < 0
              return (
                <div key={reminder.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${overdue ? 'bg-red-500' : days <= 30 ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-900">{REMINDER_LABELS[reminder.type] ?? reminder.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{formatDate(reminder.due_date)}</span>
                    <Badge
                      label={overdue ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                      variant={reminderVariant(reminder.due_date)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Property facilities */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Property Facilities</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Included, shared, and excluded areas — used in Section 5 of every PRT generated for this property.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <PropertyFacilitiesPanel propertyId={id} facilities={facilities} />
        </div>
      </div>
    </div>
  )
}
