-- ============================================================
-- PropVault Portal Test Seed
-- Purpose: end-to-end test of the tenant portal flow
-- Run in Supabase Dashboard → SQL Editor → New query → Run
-- All data is entirely synthetic.
-- ============================================================

-- Fixed IDs — record these for testing:
--   Tenant ID  : c2e4a6b8-d0f2-4a6c-8e0a-2c4e6a8b0d2f
--   Tenancy ID : 7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Tenant record (status active, RTR verified, auth_id set below
--    after the invite curl command creates the auth.users row)
-- ────────────────────────────────────────────────────────────
INSERT INTO tenants (
  id,
  first_name, last_name, email,
  status,
  right_to_rent_verified,
  right_to_rent_checked_date,
  right_to_rent_expiry,
  right_to_rent_document_type,
  created_at
) VALUES (
  'c2e4a6b8-d0f2-4a6c-8e0a-2c4e6a8b0d2f',
  'Portal', 'TestUser', 'test.portal.tenant@propvault-test.com',
  'active',
  TRUE,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '2 years',
  'UK/Irish Passport',
  NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. Tenancy on 43H St Anns Court
-- ────────────────────────────────────────────────────────────
INSERT INTO tenancies (
  id,
  tenancy_reference,
  property_id,
  landlord_id,
  status,
  start_date,
  rent_amount,
  rent_due_day,
  deposit_amount,
  deposit_scheme,
  jurisdiction
) VALUES (
  '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  'PV-TEST-PORTAL-001',
  (SELECT id FROM properties WHERE address_line_1 = '43H St Anns Court' LIMIT 1),
  (SELECT id FROM users WHERE email = 'jaimeek.bhalani@googlemail.com' LIMIT 1),
  'active',
  CURRENT_DATE,
  500.00,
  1,
  500.00,
  'mydeposits Scotland',
  'scotland'
);

-- ────────────────────────────────────────────────────────────
-- 3. Link tenant to tenancy
-- ────────────────────────────────────────────────────────────
INSERT INTO tenancy_tenants (tenancy_id, tenant_id, is_lead_tenant)
VALUES (
  '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  'c2e4a6b8-d0f2-4a6c-8e0a-2c4e6a8b0d2f',
  TRUE
);

-- ────────────────────────────────────────────────────────────
-- 4. PRT document row (path matches what generate.ts produces)
--    Upload the generated PDF to this path in prt-documents bucket.
-- ────────────────────────────────────────────────────────────
INSERT INTO documents (
  tenancy_id,
  type,
  file_url,
  uploaded_by,
  delivered_to_tenant
) VALUES (
  '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  'PRT',
  '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d/PV-TEST-PORTAL-001.pdf',
  (SELECT id FROM users WHERE email = 'jaimeek.bhalani@googlemail.com' LIMIT 1),
  FALSE
);

COMMIT;

-- ────────────────────────────────────────────────────────────
-- STEP 2 (run AFTER the invite curl command below):
-- Once the invite is sent, set auth_id on the tenant row.
-- Run this as a separate query after the curl succeeds.
-- ────────────────────────────────────────────────────────────
-- UPDATE tenants
-- SET auth_id = (
--   SELECT id FROM auth.users
--   WHERE email = 'test.portal.tenant@propvault-test.com'
--   LIMIT 1
-- )
-- WHERE id = 'c2e4a6b8-d0f2-4a6c-8e0a-2c4e6a8b0d2f';
