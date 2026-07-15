-- Migration 019: deposit certificate URL on tenancies + private storage bucket

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS deposit_certificate_url TEXT;

-- Private bucket for deposit certificate PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deposit-certificates',
  'deposit-certificates',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Landlords (owner/manager/super_admin) can read deposit certificates
-- for tenancies belonging to their legal entity
CREATE POLICY "deposit_certificates_read_internal"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deposit-certificates'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('super_admin', 'owner', 'manager')
  )
);

-- Landlords can upload deposit certificates
CREATE POLICY "deposit_certificates_insert_internal"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-certificates'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('super_admin', 'owner', 'manager')
  )
);

-- Landlords can replace an existing deposit certificate
CREATE POLICY "deposit_certificates_update_internal"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'deposit-certificates'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('super_admin', 'owner', 'manager')
  )
);
