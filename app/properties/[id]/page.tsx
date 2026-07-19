import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ComplianceCard } from '@/components/ui/ComplianceCard'
import PropertyFacilitiesPanel from './PropertyFacilitiesPanel'
import { ResolveCommButton, CompleteMaintJobButton } from './PropertyChannelActions'
import DepositCertificateUpload from './DepositCertificateUpload'
import RentLedger, { type RentRecord } from './RentLedger'
import type { Property, LegalEntity, Reminder, PropertyFacility } from '@/types'

type PropertyWithEntity = Property & {
  legal_entities: Pick<LegalEntity, 'name' | 'type'>
}

type TenancyTenant = {
  is_lead_tenant: boolean
  tenants: { id: string; first_name: string; last_name: string }
}

type ActiveTenancyData = {
  id: string
  tenancy_reference: string
  start_date: string
  rent_amount: number
  rent_due_day: number
  deposit_certificate_url: string | null
  tenancy_tenants: TenancyTenant[]
}

type ActiveTenancyScalars = Omit<ActiveTenancyData, 'tenancy_tenants'>

type PastTenancyData = {
  id: string
  tenancy_reference: string
  start_date: string
  end_date: string | null
  closed_at: string | null
  tenancy_tenants: TenancyTenant[]
}

type CommData = {
  id: string
  sender_type: string
  type: string
  body: string
  maintenance_category: string | null
  status: string
  created_at: string
}

type MaintJobData = {
  id: string
  status: string
  assigned_at: string | null
  completed_at: string | null
  landlord_notes: string | null
  communication_id: string
  created_at: string
  contractors: { name: string; trade: string } | null
}

type ViewingJobData = {
  id: string
  prospective_tenant_name: string | null
  scheduled_datetime: string | null
  status: string
  outcome: string | null
  agent_notes: string | null
  created_at: string
  viewing_agents: { name: string } | null
}

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'

const REMINDER_LABELS: Record<Reminder['type'], string> = {
  gas_safety:        'Gas Safety Certificate',
  eicr:              'EICR',
  epc:               'EPC',
  hmo_licence:       'HMO Licence',
  deposit_lodgement: 'Deposit Lodgement',
  council_tax:       'Council Tax',
  right_to_rent:     'Right to Rent',
  rent_due:          'Rent Due',
}

function statusVariant(status: Property['status']): BadgeVariant {
  switch (status) {
    case 'available':   return 'green'
    case 'occupied':    return 'blue'
    case 'maintenance': return 'yellow'
    case 'asset':       return 'gray'
  }
}

function reminderVariant(dueDate: string): BadgeVariant {
  const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'red'
  if (days <= 30) return 'yellow'
  return 'gray'
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function sortedTenants(tt: TenancyTenant[]) {
  return [...tt].sort((a, b) => (b.is_lead_tenant ? 1 : 0) - (a.is_lead_tenant ? 1 : 0))
}

const COMM_TYPE_LABEL: Record<string, string> = {
  general_message:    'Message',
  maintenance_report: 'Maintenance report',
}

const COMM_STATUS_LABEL: Record<string, string> = {
  open:        'Open',
  in_progress: 'In progress',
  resolved:    'Resolved',
  closed:      'Closed',
}

const VIEWING_STATUS_LABEL: Record<string, string> = {
  assigned:  'Assigned',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show:   'No show',
}

const OUTCOME_LABEL: Record<string, string> = {
  interested:     'Interested',
  not_interested: 'Not interested',
  no_show:        'No show',
}

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Round 1: all queries keyed only by property id
  const [
    { data: property },
    { data: reminders },
    { data: facilitiesData },
    { data: activeTenancyRaw },
    { data: pastTenanciesRaw },
    { data: allTenancyIdsRaw },
    { data: maintRaw },
    { data: viewingRaw },
  ] = await Promise.all([
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
    supabase
      .from('tenancies')
      .select('id, tenancy_reference, start_date, rent_amount, rent_due_day, deposit_certificate_url')
      .eq('property_id', id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('tenancies')
      .select('id, tenancy_reference, start_date, end_date, closed_at')
      .eq('property_id', id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(2),
    supabase
      .from('tenancies')
      .select('id')
      .eq('property_id', id),
    supabase
      .from('maintenance_jobs')
      .select('id, status, assigned_at, completed_at, landlord_notes, communication_id, created_at, contractors(name, trade)')
      .eq('property_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('viewing_jobs')
      .select('id, prospective_tenant_name, scheduled_datetime, status, outcome, agent_notes, created_at, viewing_agents(name)')
      .eq('property_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!property) notFound()

  const activeTenancyScalars = activeTenancyRaw as unknown as ActiveTenancyScalars | null
  const pastTenanciesRawTyped = (pastTenanciesRaw ?? []) as unknown as Omit<PastTenancyData, 'tenancy_tenants'>[]
  const maintJobs     = (maintRaw ?? []) as unknown as MaintJobData[]
  const viewingJobs   = (viewingRaw ?? []) as unknown as ViewingJobData[]
  const tIds          = (allTenancyIdsRaw ?? []).map((t: { id: string }) => t.id)

  // Flag overdue records before fetching (no-op if function not yet deployed)
  if (activeTenancyScalars) {
    await supabase.rpc('mark_overdue_rent_records').then(
      ({ error }) => { if (error) console.error('[rent] mark_overdue_rent_records:', error.message) }
    )
  }

  // Round 2: joins, PRT doc, communications, rent records (depend on round-1 tenancy id)
  const [
    { data: activeTTRaw, error: activeTTError },
    { data: pastTTRaw },
    { data: prtDocRaw },
    { data: commsRaw },
    { data: rentRecordsRaw },
  ] = await Promise.all([
    activeTenancyScalars
      ? supabase
          .from('tenancy_tenants')
          .select('is_lead_tenant, tenants(id, first_name, last_name)')
          .eq('tenancy_id', activeTenancyScalars.id)
      : Promise.resolve({ data: [] as TenancyTenant[], error: null }),
    pastTenanciesRawTyped.length > 0
      ? supabase
          .from('tenancy_tenants')
          .select('tenancy_id, is_lead_tenant, tenants(id, first_name, last_name)')
          .in('tenancy_id', pastTenanciesRawTyped.map(p => p.id))
      : Promise.resolve({ data: [] as (TenancyTenant & { tenancy_id: string })[], error: null }),
    activeTenancyScalars
      ? supabase
          .from('documents')
          .select('file_url')
          .eq('tenancy_id', activeTenancyScalars.id)
          .eq('type', 'PRT')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    tIds.length > 0
      ? supabase
          .from('communications')
          .select('id, sender_type, type, body, maintenance_category, status, created_at')
          .in('tenancy_id', tIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as CommData[], error: null }),
    activeTenancyScalars
      ? supabase
          .from('rent_records')
          .select('id, due_date, amount_due, amount_paid, paid_date, status, notes')
          .eq('tenancy_id', activeTenancyScalars.id)
          .order('due_date', { ascending: true })
      : Promise.resolve({ data: [] as RentRecord[], error: null }),
  ])

  if (activeTTError) {
    console.error('[property page] tenancy_tenants fetch error:', activeTTError.message, activeTTError.code)
  }

  // Merge tenancy_tenants back onto the tenancy objects
  const activeTenancyTenants = (activeTTRaw ?? []) as unknown as TenancyTenant[]
  const activeTenancy: ActiveTenancyData | null = activeTenancyScalars
    ? { ...activeTenancyScalars, tenancy_tenants: activeTenancyTenants }
    : null

  const pastTenantsByTenancy = ((pastTTRaw ?? []) as unknown as (TenancyTenant & { tenancy_id: string })[])
    .reduce<Record<string, TenancyTenant[]>>((acc, tt) => {
      ;(acc[tt.tenancy_id] ??= []).push(tt)
      return acc
    }, {})

  const pastTenancies: PastTenancyData[] = pastTenanciesRawTyped.map(pt => ({
    ...pt,
    tenancy_tenants: pastTenantsByTenancy[pt.id] ?? [],
  }))

  const prtDoc           = prtDocRaw as { file_url: string } | null
  const comms            = (commsRaw ?? []) as CommData[]
  const rentRecords      = (rentRecordsRaw ?? []) as RentRecord[]
  const facilities       = facilitiesData ?? []
  const pendingReminders = reminders ?? []

  const fullAddress = [property.address_line_1, property.address_line_2, property.city, property.postcode]
    .filter(Boolean).join(', ')

  const showCreatePrt = property.is_hmo || property.status === 'available'

  const openCommsCount   = comms.filter(c => c.status === 'open' || c.status === 'in_progress').length
  const openMaintCount   = maintJobs.filter(j => j.status === 'reported' || j.status === 'assigned').length
  const openViewingCount = viewingJobs.filter(v => v.status === 'assigned' || v.status === 'confirmed').length

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> All properties
      </Link>

      {/* Header */}
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

      {/* Details grid */}
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

      {/* ── Tenancy ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Tenancy</h2>
          {showCreatePrt && (
            <Link
              href={`/properties/${id}/create-tenancy`}
              className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              Create PRT
            </Link>
          )}
        </div>

        {activeTenancy ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Current tenancy</p>
            <InfoRow label="Reference"    value={activeTenancy.tenancy_reference} />
            <InfoRow label="Start date"   value={formatDate(activeTenancy.start_date)} />
            <InfoRow
              label="Monthly rent"
              value={`£${Number(activeTenancy.rent_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
            />
            <div className="flex items-start justify-between gap-4 py-1">
              <span className="text-sm text-gray-500 flex-shrink-0">Tenants</span>
              <div className="text-right space-y-0.5">
                {sortedTenants(activeTenancy.tenancy_tenants).map((tt) => (
                  <div key={tt.tenants.id}>
                    <Link
                      href={`/tenants/${tt.tenants.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {tt.tenants.first_name} {tt.tenants.last_name}
                      {tt.is_lead_tenant && activeTenancy.tenancy_tenants.length > 1 && (
                        <span className="text-xs text-gray-400 ml-1">(lead)</span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            {prtDoc && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-500">PRT document</span>
                <a
                  href={`/api/documents/view?bucket=prt-documents&path=${encodeURIComponent(prtDoc.file_url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View / download →
                </a>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-500">Deposit certificate</span>
              <div className="flex items-center gap-3">
                {activeTenancy.deposit_certificate_url && (
                  <a
                    href={`/api/documents/view?bucket=deposit-certificates&path=${encodeURIComponent(activeTenancy.deposit_certificate_url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View →
                  </a>
                )}
                <DepositCertificateUpload
                  propertyId={id}
                  tenancyId={activeTenancy.id}
                  hasExisting={!!activeTenancy.deposit_certificate_url}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No active tenancy.</p>
        )}

        {pastTenancies.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Past tenancies</p>
            {pastTenancies.map((pt) => (
              <div key={pt.id} className="bg-white rounded-xl border border-gray-200 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pt.tenancy_reference}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(pt.start_date)} – {pt.end_date ? formatDate(pt.end_date) : 'ongoing'}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 text-right">
                    {sortedTenants(pt.tenancy_tenants)
                      .map((tt) => `${tt.tenants.first_name} ${tt.tenants.last_name}`)
                      .join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rent ledger ──────────────────────────────────────────────────── */}
      {activeTenancy && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Rent ledger</h2>
          <RentLedger records={rentRecords} propertyId={id} />
        </div>
      )}

      {/* Compliance certificates */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Compliance certificates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {property.has_gas && (
            <ComplianceCard title="Gas Safety Certificate" expiry={property.gas_safety_expiry} />
          )}
          <ComplianceCard title="EICR" expiry={property.eicr_expiry} />
          <ComplianceCard title="EPC"  expiry={property.epc_expiry}  />
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
              const days    = Math.floor((new Date(reminder.due_date).getTime() - Date.now()) / 86400000)
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

      {/* ── Communications ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Communications</h2>
          {openCommsCount > 0 && (
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" title="Open items" />
          )}
        </div>
        {comms.length === 0 ? (
          <p className="text-sm text-gray-400">No communications yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {comms.map((c) => {
              const isOpen = c.status === 'open' || c.status === 'in_progress'
              return (
                <div key={c.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {COMM_TYPE_LABEL[c.type] ?? c.type}
                        </span>
                        {c.maintenance_category && (
                          <span className="text-xs text-gray-400">· {c.maintenance_category}</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          isOpen ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {COMM_STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 line-clamp-2">{c.body}</p>
                      <p className="text-xs text-gray-400">
                        {c.sender_type === 'tenant' ? 'From tenant' : 'From landlord'} · {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    {isOpen && <ResolveCommButton propertyId={id} commId={c.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Maintenance jobs ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Maintenance jobs</h2>
          {openMaintCount > 0 && (
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 flex-shrink-0" title="Open items" />
          )}
        </div>
        {maintJobs.length === 0 ? (
          <p className="text-sm text-gray-400">No maintenance jobs yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {maintJobs.map((j) => {
              const isOpen = j.status === 'reported' || j.status === 'assigned'
              return (
                <div key={j.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          j.status === 'completed' ? 'bg-green-50 text-green-700'
                            : j.status === 'assigned' ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}>
                          {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                        </span>
                        {j.contractors && (
                          <span className="text-xs text-gray-500">
                            {j.contractors.name} ({j.contractors.trade})
                          </span>
                        )}
                      </div>
                      {j.landlord_notes && (
                        <p className="text-sm text-gray-700">{j.landlord_notes}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        Reported {formatDate(j.created_at)}
                        {j.completed_at && ` · Completed ${formatDate(j.completed_at)}`}
                      </p>
                    </div>
                    {isOpen && <CompleteMaintJobButton propertyId={id} jobId={j.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Viewings ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Viewings</h2>
          {openViewingCount > 0 && (
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500 flex-shrink-0" title="Open items" />
          )}
        </div>
        {viewingJobs.length === 0 ? (
          <p className="text-sm text-gray-400">No viewings recorded yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {viewingJobs.map((v) => (
              <div key={v.id} className="px-6 py-4 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">
                    {v.prospective_tenant_name ?? 'Unknown'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    v.status === 'completed'  ? 'bg-green-50 text-green-700'
                      : v.status === 'cancelled' || v.status === 'no_show' ? 'bg-gray-100 text-gray-500'
                      : 'bg-violet-50 text-violet-700'
                  }`}>
                    {VIEWING_STATUS_LABEL[v.status] ?? v.status}
                  </span>
                  {v.outcome && (
                    <span className="text-xs text-gray-400">{OUTCOME_LABEL[v.outcome] ?? v.outcome}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {v.scheduled_datetime ? formatDateTime(v.scheduled_datetime) : 'No time set'}
                  {v.viewing_agents && ` · Agent: ${v.viewing_agents.name}`}
                </p>
                {v.agent_notes && (
                  <p className="text-sm text-gray-600 line-clamp-2">{v.agent_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  )
}
