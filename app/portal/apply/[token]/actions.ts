'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { sanitiseFilename } from '@/lib/utils/sanitise'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000 // 72 hours

export interface UploadState {
  error?: string
  success?: boolean
}

export async function uploadRightToRentDocument(
  token: string,
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = createServiceClient()

  // Re-validate token server-side on every submission
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, status, created_at')
    .eq('unique_link_token', token)
    .single()

  if (tenantError || !tenant) {
    return { error: 'This link is invalid.' }
  }

  if (tenant.status !== 'prospective') {
    return { error: 'This link is no longer active.' }
  }

  const tokenAge = Date.now() - new Date(tenant.created_at).getTime()
  if (tokenAge > TOKEN_EXPIRY_MS) {
    return { error: 'This link has expired. Please contact your landlord to request a new one.' }
  }

  const file = formData.get('document') as File | null
  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' }
  }

  // Server-side file validation
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: 'File must be a JPEG, PNG, or PDF.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File must be under 10MB.' }
  }

  const safeName = sanitiseFilename(file.name)
  const timestamp = Date.now()
  // Path includes tenant_id so landlord can retrieve by tenant in Step 10
  const storagePath = `${tenant.id}/${timestamp}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('right-to-rent-documents')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { error: 'Upload failed. Please try again.' }
  }

  // Create document record — tenancy_id null at this stage (pre-tenancy)
  const { error: docError } = await supabase
    .from('documents')
    .insert({
      type: 'right_to_rent',
      file_url: storagePath,
      tenancy_id: null,
      property_id: null,
      uploaded_by: null,
      delivered_to_tenant: false,
    })

  if (docError) {
    // Clean up the uploaded file if record creation fails
    await supabase.storage.from('right-to-rent-documents').remove([storagePath])
    return { error: 'Failed to record your document. Please try again.' }
  }

  return { success: true }
}
