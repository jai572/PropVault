import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import TenantActions from './TenantActions'
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

export default async function TenantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Scope to the current user's own legal entities.
  // Super_admin with no entity links sees nothing here; use /admin for cross-portfolio browsing.
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">No portfolio linked to this account.</p>
        </div>
        {usersRow?.role === 'super_admin' && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-sm text-gray-600">
            You are signed in as <span className="font-medium">super_admin</span>. Use the{' '}
            <a href="/admin" className="font-medium text-gray-900 underline underline-offset-2">
              Admin panel
            </a>{' '}
            to browse any landlord&apos;s tenants by email or legal entity name.
          </div>
        )}
      </div>
    )
  }

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .neq('status', 'purged')
    .order('created_at', { ascending: false })
    .returns<Tenant[]>()

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load tenants. Please refresh.
      </div>
    )
  }

  const list = tenants ?? []

  // Fetch right-to-rent document counts scoped to this user's tenants only.
  // The documents table has no tenant_id FK so we cannot filter at the DB level;
  // instead we filter in memory against the tenant IDs already scoped by RLS above.
  // TODO(security): add tenant_id FK to documents to enable a DB-level filter.
  const tenantIdSet = new Set(list.map((t) => t.id))
  const serviceClient = createServiceClient()
  const docCountByTenant = new Map<string, number>()
  if (tenantIdSet.size > 0) {
    const { data: allDocs } = await serviceClient
      .from('documents')
      .select('file_url')
      .eq('type', 'right_to_rent')
    for (const doc of allDocs ?? []) {
      const tenantId = doc.file_url.split('/')[0]
      if (tenantIdSet.has(tenantId)) {
        docCountByTenant.set(tenantId, (docCountByTenant.get(tenantId) ?? 0) + 1)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">{list.length} active or prospective</p>
        </div>
        <Link
          href="/tenants/new"
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          Add prospective tenant
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">No tenants yet.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Right to Rent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Docs</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((tenant) => {
                  const docCount = docCountByTenant.get(tenant.id) ?? 0
                  return (
                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <Link href={`/tenants/${tenant.id}`} className="block w-full text-blue-600 hover:text-blue-800 hover:underline">
                          {tenant.first_name} {tenant.last_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <Link href={`/tenants/${tenant.id}`} className="block w-full">
                          {tenant.email}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/tenants/${tenant.id}`} className="block w-full">
                          <Badge label={tenant.status} variant={statusVariant(tenant.status)} />
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/tenants/${tenant.id}`} className="block w-full">
                          {tenant.right_to_rent_verified ? (
                            <Badge label="Verified" variant="green" />
                          ) : (
                            <Badge label="Pending" variant="gray" />
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <Link href={`/tenants/${tenant.id}`} className="block w-full">
                          {docCount > 0 ? `${docCount} file${docCount !== 1 ? 's' : ''}` : '—'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        <Link href={`/tenants/${tenant.id}`} className="block w-full">
                          {new Date(tenant.created_at).toLocaleDateString('en-GB')}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tenant.status === 'prospective' && (
                          <TenantActions
                            tenantId={tenant.id}
                            tenantName={`${tenant.first_name} ${tenant.last_name}`}
                            hasDocuments={docCount > 0}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {list.map((tenant) => {
              const docCount = docCountByTenant.get(tenant.id) ?? 0
              return (
                <div key={tenant.id} className="relative bg-white rounded-xl border border-gray-200 p-4">
                  <Link href={`/tenants/${tenant.id}`} className="absolute inset-0 rounded-xl" aria-label={`${tenant.first_name} ${tenant.last_name}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-blue-600">{tenant.first_name} {tenant.last_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tenant.email}</p>
                    </div>
                    <Badge label={tenant.status} variant={statusVariant(tenant.status)} />
                  </div>
                  <div className="relative mt-2 flex items-center justify-between gap-2 z-10">
                    <div className="flex items-center gap-2">
                      {tenant.right_to_rent_verified ? (
                        <Badge label="Right to Rent verified" variant="green" />
                      ) : (
                        <Badge label="Right to Rent pending" variant="gray" />
                      )}
                      {docCount > 0 && (
                        <span className="text-xs text-gray-500">{docCount} file{docCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {tenant.status === 'prospective' && (
                      <TenantActions
                        tenantId={tenant.id}
                        tenantName={`${tenant.first_name} ${tenant.last_name}`}
                        hasDocuments={docCount > 0}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
