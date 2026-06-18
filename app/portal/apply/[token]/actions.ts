'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { sanitiseFilename } from '@/lib/utils/sanitise'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000

export interface UploadState {
  error?: string
  // Names of files successfully uploaded in this submission
  uploaded?: string[]
  // Per-file validation errors: { filename: errorMessage }
  fileErrors?: Record<string, string>
}

export async function uploadRightToRentDocuments(
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

  if (tenantError || !tenant) return { error: 'This link is invalid.' }
  if (tenant.status !== 'prospective') return { error: 'This link is no longer active.' }

  const tokenAge = Date.now() - new Date(tenant.created_at).getTime()
  if (tokenAge > TOKEN_EXPIRY_MS) {
    return { error: 'This link has expired. Please contact your landlord to request a new one.' }
  }

  const rawFiles = formData.getAll('documents') as File[]
  const files = rawFiles.filter((f) => f instanceof File && f.size > 0)

  if (files.length === 0) {
    return { error: 'Please select at least one file to upload.' }
  }

  // Validate all files before uploading any — fail fast on bad input
  const fileErrors: Record<string, string> = {}
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      fileErrors[file.name] = 'Must be a JPEG, PNG, or PDF.'
    } else if (file.size > MAX_FILE_SIZE) {
      fileErrors[file.name] = 'Must be under 10MB.'
    }
  }

  if (Object.keys(fileErrors).length > 0) {
    return { fileErrors }
  }

  // Upload each file individually — separate storage file and documents row per file
  const uploaded: string[] = []
  const uploadFileErrors: Record<string, string> = {}

  for (const file of files) {
    const safeName = sanitiseFilename(file.name)
    // Unique timestamp per file to prevent collisions in the same batch
    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const storagePath = `${tenant.id}/${timestamp}_${safeName}`

    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('right-to-rent-documents')
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      uploadFileErrors[file.name] = 'Upload failed. Please try again.'
      continue
    }

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
      // Roll back the storage upload if the DB insert fails
      await supabase.storage.from('right-to-rent-documents').remove([storagePath])
      uploadFileErrors[file.name] = 'Failed to record document. Please try again.'
      continue
    }

    uploaded.push(file.name)
  }

  if (uploaded.length === 0) {
    return { fileErrors: uploadFileErrors }
  }

  // Partial success: some uploaded, some failed
  if (Object.keys(uploadFileErrors).length > 0) {
    return { uploaded, fileErrors: uploadFileErrors }
  }

  return { uploaded }
}
