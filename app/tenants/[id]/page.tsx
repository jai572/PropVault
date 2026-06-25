import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import VerifyRightToRent from './VerifyRightToRent'
import ResendLinkPanel from './ResendLinkPanel'
import type { Tenant } from '@/types'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'

function statusVariant(status: Tenant['status']): BadgeVariant {
  switch (status) {
    case 'prospective': return 'yellow'
    case 'active':      return 'green'
    case 'closed':      return 'gray'
    case 'purged':      return 'gray'
    case 'withdrawn':   return 'gray'
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMoney(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  pending:   'Pending resolution',
  refunded:  'Refunded',
  retained:  'Retained',
  disputed:  'Disputed',
}

const CLOSURE_REASON_LABELS: Record<string, string> = {
  tenant_notice:    'Tenant gave notice',
  landlord_notice:  'Landlord gave notice',
  mutual_agreement: 'Mutual agreement',
  other:            'Other',
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single<Tenant>()

  if (!tenant) redirect('/tenants')

  // Fetch Right to Rent documents
  const serviceClient = createServiceClient()
  const { data: allDocs } = await serviceClient
    .from('documents')
    .select('id, file_url, created_at')
    .eq('type', 'right_to_rent')
    .like('file_url', `${tenant.id}/%`)
    .order('created_at', { ascending: true })

  const docs = (allDocs ?? []).map((doc) => {
    const filename = doc.file_url.split('/').pop() ?? doc.file_url
    const displayName = filename.replace(/^\d+_[a-z0-9]+_/i, '')
    const viewHref = `/api/documents/view?path=${encodeURIComponent(doc.file_url)}`
    return { id: doc.id, file_url: doc.file_url, displayName, viewHref, uploadedAt: doc.created_at }
  })

  // Fetch tenancy (active or most-recent closed) with property and PRT docs
  const { data: ttRows } = await supabase
    .from('tenancy_tenants')
    .select(`
      tenancies (
        id, tenancy_reference, status, start_date, end_date, rent_amount,
        deposit_amount, deposit_scheme, deposit_status, deposit_refund_amount,
        deposit_resolution_notes, closure_reason, closure_reason_other, closed_at,
        property_id,
        properties ( id, address_line_1, address_line_2, city, postcode )
      )
    `)
    .eq('tenant_id', id)

  type TenancyRow = {
    id: string; tenancy_reference: string; status: string
    start_date: string; end_date: string | null
    rent_amount: number; deposit_amount: number | null; deposit_scheme: string | null
    deposit_status: string; deposit_refund_amount: number | null
    deposit_resolution_notes: string | null
    closure_reason: string | null; closure_reason_other: string | null; closed_at: string | null
    property_id: string
    properties: { id: string; address_line_1: string; address_line_2: string | null; city: string; postcode: string }
  }

  const tenancies = (ttRows ?? [])
    .map(r => r.tenancies as unknown as TenancyRow)
    .filter(Boolean)
    .sort((a, b) => (a.status === 'active' ? -1 : 1) || new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

  const activeTenancy = tenancies.find(t => t.status === 'active') ?? null
  const closedTenancy = !activeTenancy ? (tenancies.find(t => t.status === 'closed') ?? null) : null
  const displayTenancy = activeTenancy ?? closedTenancy

  // Fetch PRT document(s) for the displayed tenancy
  let prtDocs: { id: string; file_url: string; viewHref: string }[] = []
  if (displayTenancy) {
    const { data: prtData } = await serviceClient
      .from('documents')
      .select('id, file_url')
      .eq('tenancy_id', displayTenancy.id)
      .eq('type', 'PRT')
      .order('created_at', { ascending: false })
    prtDocs = (prtData ?? []).map(d => ({
      id: d.id,
      file_url: d.file_url,
      viewHref: `/api/documents/view?path=${encodeURIComponent(d.file_url)}&bucket=prt-documents`,
    }))
  }

  const isVerified = tenant.right_to_rent_verified
  const canVerify  = !isVerified && docs.length > 0 && tenant.status !== 'purged'

  const canResolveDeposit = tenant.status === 'closed'
    && closedTenancy
    && closedTenancy.deposit_status === 'pending'
    && (closedTenancy.deposit_amount ?? 0) > 0

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span aria-hidden="true">←</span> All tenants
      </Link>

      {/* Tenant header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {tenant.first_name} {tenant.last_name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{tenant.email}</p>
          {tenant.phone && <p className="text-sm text-gray-500">{tenant.phone}</p>}
        </div>
        <Badge label={tenant.status} variant={statusVariant(tenant.status)} />
      </div>

      {/* Active tenancy card */}
      {displayTenancy && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {displayTenancy.status === 'active' ? 'Active tenancy' : 'Closed tenancy'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{displayTenancy.tenancy_reference}</p>
            </div>
            {displayTenancy.status === 'active' && (
              <Link
                href={`/tenants/${id}/close-tenancy`}
                className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close tenancy
              </Link>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-gray-500">Property</dt>
            <dd className="text-gray-900">
              <Link
                href={`/properties/${displayTenancy.properties.id}`}
                className="text-blue-600 hover:underline"
              >
                {[
                  displayTenancy.properties.address_line_1,
                  displayTenancy.properties.address_line_2,
                  displayTenancy.properties.city,
                  displayTenancy.properties.postcode,
                ].filter(Boolean).join(', ')}
              </Link>
            </dd>

            <dt className="text-gray-500">Start date</dt>
            <dd className="text-gray-900">{fmtDate(displayTenancy.start_date)}</dd>

            {displayTenancy.end_date && (
              <>
                <dt className="text-gray-500">End date</dt>
                <dd className="text-gray-900">{fmtDate(displayTenancy.end_date)}</dd>
              </>
            )}

            <dt className="text-gray-500">Monthly rent</dt>
            <dd className="text-gray-900">{fmtMoney(displayTenancy.rent_amount)}</dd>

            {displayTenancy.deposit_amount && (
              <>
                <dt className="text-gray-500">Deposit</dt>
                <dd className="text-gray-900">
                  {fmtMoney(displayTenancy.deposit_amount)}
                  {displayTenancy.deposit_scheme ? ` · ${displayTenancy.deposit_scheme}` : ''}
                </dd>
              </>
            )}

            {displayTenancy.status === 'closed' && displayTenancy.deposit_amount && (
              <>
                <dt className="text-gray-500">Deposit status</dt>
                <dd className={`font-medium ${displayTenancy.deposit_status === 'pending' ? 'text-amber-600' : 'text-gray-900'}`}>
                  {DEPOSIT_STATUS_LABELS[displayTenancy.deposit_status] ?? displayTenancy.deposit_status}
                  {displayTenancy.deposit_refund_amount != null && (
                    <span className="font-normal text-gray-500 ml-1">
                      ({fmtMoney(displayTenancy.deposit_refund_amount)} refunded)
                    </span>
                  )}
                </dd>
              </>
            )}

            {displayTenancy.status === 'closed' && displayTenancy.closure_reason && (
              <>
                <dt className="text-gray-500">Closure reason</dt>
                <dd className="text-gray-900">
                  {CLOSURE_REASON_LABELS[displayTenancy.closure_reason] ?? displayTenancy.closure_reason}
                  {displayTenancy.closure_reason === 'other' && displayTenancy.closure_reason_other
                    ? ` — ${displayTenancy.closure_reason_other}`
                    : ''}
                </dd>
              </>
            )}
          </dl>

          {/* PRT document */}
          {prtDocs.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 font-medium mb-2">PRT document</p>
              {prtDocs.map(d => (
                <a
                  key={d.id}
                  href={d.viewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View / Download PRT
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolve deposit CTA */}
      {canResolveDeposit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-900">Deposit resolution pending</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Record the outcome of the deposit held for this tenancy.
            </p>
          </div>
          <Link
            href={`/tenants/${id}/resolve-deposit`}
            className="flex-shrink-0 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 transition-colors"
          >
            Resolve deposit
          </Link>
        </div>
      )}

      {/* Right to Rent verification status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Right to Rent</h2>
        {isVerified ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">Verified</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-2">
              {tenant.right_to_rent_document_type && (
                <>
                  <dt className="text-gray-500">Document type</dt>
                  <dd className="text-gray-900">{tenant.right_to_rent_document_type}</dd>
                </>
              )}
              {tenant.right_to_rent_checked_date && (
                <>
                  <dt className="text-gray-500">Date checked</dt>
                  <dd className="text-gray-900">{fmtDate(tenant.right_to_rent_checked_date)}</dd>
                </>
              )}
              {tenant.right_to_rent_expiry && (
                <>
                  <dt className="text-gray-500">Document expiry</dt>
                  <dd className="text-gray-900">{fmtDate(tenant.right_to_rent_expiry)}</dd>
                </>
              )}
            </dl>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
            <p className="text-sm text-gray-700">Not yet verified</p>
          </div>
        )}
      </div>

      {/* Uploaded Right to Rent documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          Uploaded documents
          {docs.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {docs.length} file{docs.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {docs.length === 0 ? (
          <p className="text-sm text-gray-400">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <li key={doc.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{doc.displayName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <a
                  href={doc.viewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create PRT — shown only when Right to Rent is verified and still prospective */}
      {isVerified && tenant.status === 'prospective' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Right to Rent verified</p>
            <p className="text-xs text-gray-500 mt-0.5">Ready to create a Private Residential Tenancy.</p>
          </div>
          <Link
            href={`/tenants/${tenant.id}/create-tenancy`}
            className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Create PRT
          </Link>
        </div>
      )}

      {/* Tenant application link — resend/regenerate for prospective tenants */}
      {tenant.status === 'prospective' && tenant.unique_link_token && (
        <ResendLinkPanel
          tenantId={tenant.id}
          linkExpiresAt={tenant.link_expires_at ?? null}
          createdAt={tenant.created_at}
        />
      )}

      {/* Verification form */}
      {canVerify && <VerifyRightToRent tenantId={tenant.id} />}

      {!canVerify && !isVerified && docs.length === 0 && tenant.status === 'prospective' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-500">
          The verification form will appear once the tenant has uploaded their documents.
        </div>
      )}
    </div>
  )
}
