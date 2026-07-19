import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/auth/actions'
import Link from 'next/link'

export default async function AppNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('auth_id', user.id)
    .single()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-bold text-gray-900">
              PropVault
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Properties
              </Link>
              <Link
                href="/tenants"
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Tenants
              </Link>
              {profile?.role === 'super_admin' && (
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">{profile?.name ?? user.email}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  )
}
