import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/login', '/portal', '/survey', '/api/survey', '/founding', '/api/founding', '/auth/reset-password']

// Routes only landlords may access
const LANDLORD_ONLY_PREFIXES = ['/dashboard', '/properties', '/tenants']
// Routes only tenants may access
const TENANT_ONLY_PREFIXES = ['/portal/dashboard', '/api/portal']

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    // Determine correct home by role before redirecting
    const { data: landlordRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()
    const dest = request.nextUrl.clone()
    dest.pathname = landlordRow ? '/dashboard' : '/portal/dashboard'
    return NextResponse.redirect(dest)
  }

  // Role-based routing for authenticated users on role-restricted paths
  const needsLandlordCheck = LANDLORD_ONLY_PREFIXES.some(p => pathname.startsWith(p))
  const needsTenantCheck   = TENANT_ONLY_PREFIXES.some(p => pathname.startsWith(p))

  if (user && (needsLandlordCheck || needsTenantCheck)) {
    const { data: landlordRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()
    const isLandlord = !!landlordRow

    if (needsLandlordCheck && !isLandlord) {
      // Tenant trying to access landlord routes → send to tenant portal
      const dest = request.nextUrl.clone()
      dest.pathname = '/portal/dashboard'
      return NextResponse.redirect(dest)
    }

    if (needsTenantCheck && isLandlord) {
      // Landlord trying to access tenant-only routes → send to landlord dashboard
      const dest = request.nextUrl.clone()
      dest.pathname = '/dashboard'
      return NextResponse.redirect(dest)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
