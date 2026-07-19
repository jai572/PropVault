-- Migration 029: break tenants RLS circular dependency
--
-- tenants_by_legal_entity queries tenancy_tenants → tenancies policy queries
-- properties → which is fine, but the tenancy_tenants policy itself can
-- re-enter the tenants policy, creating a cycle (42P17).
--
-- Fix: SECURITY DEFINER function that walks the full chain as postgres
-- (bypassing RLS on every table it touches), returning all tenant IDs
-- reachable through the current user's legal entities.

CREATE OR REPLACE FUNCTION current_owner_tenant_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT tt.tenant_id
  FROM tenancy_tenants tt
  JOIN tenancies ten ON ten.id = tt.tenancy_id
  JOIN properties p   ON p.id  = ten.property_id
  WHERE p.legal_entity_id = ANY(SELECT current_user_legal_entity_ids());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Rebuild tenants policies using the new function

DROP POLICY IF EXISTS "tenants_by_legal_entity" ON tenants;
CREATE POLICY "tenants_by_legal_entity" ON tenants
  FOR ALL USING (
    id = ANY(SELECT current_owner_tenant_ids())
    OR current_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "tenants_self_read" ON tenants;
CREATE POLICY "tenants_self_read" ON tenants
  FOR SELECT USING (id = current_tenant_id());
