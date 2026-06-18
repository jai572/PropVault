-- Phase 2 Step 9 (amendment): add created_by_user_id to tenants, add withdrawn status
--
-- created_by_user_id: nullable so existing test records are not broken.
-- Enables legal-entity-scoped duplicate email checks at application level.
--
-- withdrawn status: for prospective tenants who have submitted documents
-- but will not proceed. Token invalidated, documents retained, record kept.

-- 1. Add created_by_user_id
ALTER TABLE tenants
  ADD COLUMN created_by_user_id UUID REFERENCES users(id);

-- 2. Add 'withdrawn' to the status check constraint
ALTER TABLE tenants DROP CONSTRAINT tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('prospective', 'active', 'closed', 'purged', 'withdrawn'));
