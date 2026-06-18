-- Phase 2 Step 9 (amendment): add created_by_user_id, legal_entity_id to tenants;
-- add 'withdrawn' to status enum.
--
-- created_by_user_id: tracks which internal user created the record.
--   Nullable so existing test records are not broken.
--
-- legal_entity_id: records which legal entity this tenant was recruited for.
--   Required for correct duplicate email scoping (including when super_admin
--   creates a tenant on behalf of a specific entity). Nullable for existing rows.
--
-- withdrawn: prospective tenant who submitted documents but will not proceed.
--   Token invalidated, documents retained.

-- 1. Add created_by_user_id
ALTER TABLE tenants
  ADD COLUMN created_by_user_id UUID REFERENCES users(id);

-- 2. Add legal_entity_id
ALTER TABLE tenants
  ADD COLUMN legal_entity_id UUID REFERENCES legal_entities(id);

-- 3. Add 'withdrawn' to the status check constraint
ALTER TABLE tenants DROP CONSTRAINT tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('prospective', 'active', 'closed', 'purged', 'withdrawn'));
