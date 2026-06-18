import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import VerifyRightToRent from './VerifyRightToRent'
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

const SIGNED_URL_EXPIRY_SECONDS = 300 // 5-minute signed URLs

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

  // Fetch Right to Rent documents for this tenant via service client
  // Documents are stored at {tenant_id}/{timestamp}_{filename}
  const serviceClient = createServiceClient()

  const { data: allDocs } = await serviceClient
    .from('documents')
    .select('id, file_url, created_at')
    .eq('type', 'right_to_rent')
    .like('file_url', `${tenant.id}/%`)
    .order('created_at', { ascending: true })

  const docs = allDocs ?? []

  // Generate short-lived signed URLs for each document (private bucket)
  const signedDocs = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await serviceClient.storage
        .from('right-to-rent-documents')
        .createSignedUrl(doc.file_url, SIGNED_URL_EXPIRY_SECONDS)

      const filename = doc.file_url.split('/').pop() ?? doc.file_url
      // Strip the timestamp prefix from display name: {timestamp}_{random}_{original}
      const displayName = filename.replace(/^\d+_[a-z0-9]+_/, '')

      return {
        id: doc.id,
        file_url: doc.file_url,
        signedUrl: data?.signedUrl ?? null,
        displayName,
        uploadedAt: doc.created_at,
      }
    })
  )

  const isVerified = tenant.right_to_rent_verified
  const canVerify  = !isVerified && docs.length > 0 && tenant.status !== 'purged'

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

      {/* Verification status */}
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
                  <dd className="text-gray-900">
                    {new Date(tenant.right_to_rent_checked_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </dd>
                </>
              )}
              {tenant.right_to_rent_expiry && (
                <>
                  <dt className="text-gray-500">Document expiry</dt>
                  <dd className="text-gray-900">
                    {new Date(tenant.right_to_rent_expiry).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </dd>
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

      {/* Uploaded documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          Uploaded documents
          {docs.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {docs.length} file{docs.length !== 1 ? 's' : ''} · links expire in 5 minutes
            </span>
          )}
        </h2>

        {docs.length === 0 ? (
          <p className="text-sm text-gray-400">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {signedDocs.map((doc) => (
              <li key={doc.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{doc.displayName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    View
                  </a>
                ) : (
                  <span className="flex-shrink-0 text-xs text-gray-400">Unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Verification form — shown only if not yet verified and docs exist */}
      {canVerify && <VerifyRightToRent tenantId={tenant.id} />}

      {!canVerify && !isVerified && docs.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-500">
          The verification form will appear once the tenant has uploaded their documents.
        </div>
      )}
    </div>
  )
}
