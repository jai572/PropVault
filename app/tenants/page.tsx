import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import type { Tenant } from '@/types'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'

function statusVariant(status: Tenant['status']): BadgeVariant {
  switch (status) {
    case 'prospective': return 'yellow'
    case 'active':      return 'green'
    case 'closed':      return 'gray'
    case 'purged':      return 'gray'
  }
}

export default async function TenantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .in('status', ['prospective', 'active'])
    .order('created_at', { ascending: false })
    .returns<Tenant[]>()

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load tenants. Please refresh.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">{tenants?.length ?? 0} active or prospective</p>
        </div>
        <Link
          href="/tenants/new"
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          Add prospective tenant
        </Link>
      </div>

      {(tenants?.length ?? 0) === 0 ? (
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants?.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {tenant.first_name} {tenant.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{tenant.email}</td>
                    <td className="px-6 py-4">
                      <Badge label={tenant.status} variant={statusVariant(tenant.status)} />
                    </td>
                    <td className="px-6 py-4">
                      {tenant.right_to_rent_verified ? (
                        <Badge label="Verified" variant="green" />
                      ) : (
                        <Badge label="Pending" variant="gray" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(tenant.created_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {tenants?.map((tenant) => (
              <div key={tenant.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tenant.first_name} {tenant.last_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tenant.email}</p>
                  </div>
                  <Badge label={tenant.status} variant={statusVariant(tenant.status)} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {tenant.right_to_rent_verified ? (
                    <Badge label="Right to Rent verified" variant="green" />
                  ) : (
                    <Badge label="Right to Rent pending" variant="gray" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
