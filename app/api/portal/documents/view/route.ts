import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const SIGNED_URL_EXPIRY_SECONDS = 300
const ALLOWED_BUCKETS = ['prt-documents', 'deposit-certificates']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const path   = request.nextUrl.searchParams.get('path')
  const bucket = request.nextUrl.searchParams.get('bucket')

  if (!path || !bucket) {
    return NextResponse.json({ error: 'Missing path or bucket' }, { status: 400 })
  }
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
  }

  // Resolve tenant record for this auth user
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find the active tenancy for this tenant
  const { data: ttRow } = await supabase
    .from('tenancy_tenants')
    .select('tenancy_id, tenancies(id, deposit_certificate_url)')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!ttRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenancyId = ttRow.tenancy_id
  const tenancy = ttRow.tenancies as unknown as { id: string; deposit_certificate_url: string | null } | null

  // Validate the tenant is actually allowed to access this path
  if (bucket === 'prt-documents') {
    // PRT paths are stored as {tenancy_id}/{filename}
    if (!path.startsWith(`${tenancyId}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (bucket === 'deposit-certificates') {
    // Must exactly match the stored deposit_certificate_url
    if (!tenancy || tenancy.deposit_certificate_url !== path) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const svc = createServiceClient()
  const { data, error } = await svc.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
