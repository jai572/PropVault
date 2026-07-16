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

  // Tenant profile
  const { data: profile, error: profileError } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, email, status')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[/api/portal/me] tenants query error:', profileError.message, profileError.code)
    return NextResponse.json({ error: profileError.message, code: profileError.code }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ profile: null, tenancy: null, prt: null })
  }

  // Active tenancy via tenancy_tenants
  const { data: tenancyRow, error: tenancyError } = await supabase
    .from('tenancy_tenants')
    .select(`
      tenancy:tenancies (
        id,
        tenancy_reference,
        start_date,
        rent_amount,
        rent_due_day,
        deposit_amount,
        deposit_scheme,
        deposit_certificate_url,
        status
      )
    `)
    .eq('tenant_id', profile.id)
    .filter('tenancy.status', 'eq', 'active')
    .maybeSingle()

  if (tenancyError) {
    console.error('[/api/portal/me] tenancy_tenants query error:', tenancyError.message, tenancyError.code)
    return NextResponse.json({ error: tenancyError.message, code: tenancyError.code }, { status: 500 })
  }

  const tenancy = (tenancyRow?.tenancy as unknown as Record<string, unknown> | null) ?? null

  // PRT document for this tenancy
  let prt: { id: string; file_url: string } | null = null
  if (tenancy?.id) {
    const { data: prtRow, error: prtError } = await supabase
      .from('documents')
      .select('id, file_url')
      .eq('tenancy_id', tenancy.id as string)
      .eq('type', 'PRT')
      .not('file_url', 'is', null)
      .neq('file_url', '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prtError) {
      console.error('[/api/portal/me] documents query error:', prtError.message, prtError.code)
    } else {
      prt = prtRow
    }
  }

  return NextResponse.json({ profile, tenancy, prt })
}
