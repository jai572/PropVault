-- Phase 2 Step 9: Private storage bucket for Right to Rent documents
--
-- SECURITY: bucket is private (public = false). No public URLs.
-- File size limit: 10MB. Allowed types: JPEG, PNG, WebP, PDF.
-- Uploads are performed server-side using the service role key only.
-- Landlord access via signed URLs generated server-side (Step 10).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'right-to-rent-documents',
  'right-to-rent-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects for this bucket
-- Authenticated landlords (super_admin or owner) can read documents.
-- Writes are handled exclusively by the service role key in server actions.
-- Storage path convention: right-to-rent-documents/{tenant_id}/{filename}

CREATE POLICY "rtr_landlord_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'right-to-rent-documents'
  AND (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) = 'super_admin'
    OR
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'manager')
  )
);
