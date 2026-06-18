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

  const path = request.nextUrl.searchParams.get('path')
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  // path must match {uuid}/{rest} — basic guard against traversal
  const pathPattern = /^[0-9a-f-]{36}\/.+$/i
  if (!pathPattern.test(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient.storage
    .from('right-to-rent-documents')
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error)
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }

  // Redirect directly to the signed URL
  return NextResponse.redirect(data.signedUrl)
}
