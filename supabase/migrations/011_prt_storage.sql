-- Migration 011: Storage bucket for PRT documents
-- Private bucket — access via signed URLs generated server-side only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prt-documents',
  'prt-documents',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated internal users (super_admin, owner, manager) can read PRTs
-- that belong to tenancies they have access to.
CREATE POLICY "prt_documents_read_internal"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prt-documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('super_admin', 'owner', 'manager')
  )
);
