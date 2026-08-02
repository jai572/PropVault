import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const SIGNED_URL_EXPIRY_SECONDS = 300 // 5 minutes

export async function GET(request: NextRequest) {
  // Require authenticated internal user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const path   = request.nextUrl.searchParams.get('path')
  const bucket = request.nextUrl.searchParams.get('bucket') ?? 'right-to-rent-documents'

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  // path must match {uuid}/{rest} — basic guard against traversal
  const pathPattern = /^[0-9a-f-]{36}\/.+$/i
  if (!pathPattern.test(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  // Only allow known private buckets
  const ALLOWED_BUCKETS = ['right-to-rent-documents', 'prt-documents', 'deposit-certificates']
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
  }

  // Ownership check — the first path segment is the resource UUID (tenant or tenancy).
  // Use the RLS-scoped anon client: if the caller cannot see the row, RLS returns null → 403.
  // This works for both landlord sessions (entity-scoped via user_legal_entities) and
  // tenant sessions (self-read via current_tenant_id / current_tenant_tenancy_ids).
  const resourceId = path.split('/')[0]

  if (bucket === 'right-to-rent-documents') {
    // First segment is a tenant UUID
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', resourceId)
      .maybeSingle()
    if (!tenantRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    // prt-documents and deposit-certificates: first segment is a tenancy UUID
    const { data: tenancyRow } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', resourceId)
      .maybeSingle()
    if (!tenancyRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error)
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }

  // Redirect directly to the signed URL
  return NextResponse.redirect(data.signedUrl)
}
