import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('first_name, last_name, email, status')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[/api/portal/me] tenants query error:', error.message, error.code)
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
