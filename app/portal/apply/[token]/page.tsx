import { createServiceClient } from '@/lib/supabase/service'
import UploadForm from './UploadForm'

const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000

interface ApplyPageProps {
  params: Promise<{ token: string }>
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { token } = await params

  // Validate token format before hitting the DB
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(token)) {
    return <InvalidPage />
  }

  const supabase = createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, first_name, status, created_at')
    .eq('unique_link_token', token)
    .single()

  if (!tenant || tenant.status !== 'prospective') {
    return <InvalidPage />
  }

  const tokenAge = Date.now() - new Date(tenant.created_at).getTime()
  if (tokenAge > TOKEN_EXPIRY_MS) {
    return <ExpiredPage />
  }

  const expiresAt = new Date(new Date(tenant.created_at).getTime() + TOKEN_EXPIRY_MS)
  const expiryString = expiresAt.toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">PropVault</h1>
          <p className="mt-1 text-sm text-gray-500">Right to Rent document submission</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Hello, {tenant.first_name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please upload your Right to Rent document below. This link expires on{' '}
              <strong>{expiryString}</strong>.
            </p>
          </div>

          <UploadForm token={token} />
        </div>

        <p className="text-center text-xs text-gray-400">
          Your document is stored securely and will only be accessed by your landlord.
        </p>
      </div>
    </div>
  )
}

function InvalidPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Link not found</h1>
        <p className="text-sm text-gray-500">
          This link is invalid or has already been used. Please contact your landlord.
        </p>
      </div>
    </div>
  )
}

function ExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Link expired</h1>
        <p className="text-sm text-gray-500">
          This link expired after 72 hours. Please contact your landlord to request a new one.
        </p>
      </div>
    </div>
  )
}
