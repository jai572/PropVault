-- Migration 021: fix circular RLS dependency between tenants and tenancy_tenants
--
-- Root cause: migration 020 added tenant-side clauses to tenancy_tenants,
-- tenancies, and documents policies that queried the tenants table directly
-- (SELECT id FROM tenants WHERE auth_id = auth.uid()). The tenants policy
-- already queries tenancy_tenants, creating a circular dependency:
--
--   tenants policy → queries tenancy_tenants
--   tenancy_tenants policy → queries tenants
--   tenants policy → queries tenancy_tenants → ...
--
-- PostgreSQL detects the recursion and the query hangs, which is why the
-- Supabase call never resolves and the log after the try/catch never fires.
--
-- Fix: introduce current_tenant_id() as SECURITY DEFINER (bypasses RLS,
-- same pattern as current_user_role() and current_user_legal_entity_id()),
-- then rebuild all three policies using it instead of a raw subquery.

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT id FROM tenants WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── tenancies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenancies_by_landlord" ON tenancies;

CREATE POLICY "tenancies_by_landlord" ON tenancies
  FOR ALL USING (
    landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR current_user_role() = 'super_admin'
    OR id IN (
      SELECT tenancy_id FROM tenancy_tenants
      WHERE tenant_id = current_tenant_id()
    )
  );

-- ── tenancy_tenants ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenancy_tenants_by_landlord" ON tenancy_tenants;

CREATE POLICY "tenancy_tenants_by_landlord" ON tenancy_tenants
  FOR ALL USING (
    tenancy_id IN (
      SELECT id FROM tenancies
      WHERE landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
    OR current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- ── documents ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents_by_legal_entity" ON documents;

CREATE POLICY "documents_by_legal_entity" ON documents
  FOR ALL USING (
    tenancy_id IN (
      SELECT t.id FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = current_user_legal_entity_id()
    )
    OR property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
    OR tenancy_id IN (
      SELECT tenancy_id FROM tenancy_tenants
      WHERE tenant_id = current_tenant_id()
    )
  );
