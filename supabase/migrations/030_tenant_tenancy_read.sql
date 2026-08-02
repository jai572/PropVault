-- Migration 030: current_tenant_tenancy_ids() + tenancies policy tenant branch
--
-- Applied directly in Supabase SQL Editor; captured here for reconciliation.
--
-- Problem: authenticated tenants could not read their own tenancy row via the
-- portal because tenancies_by_landlord (migration 028) had no tenant-side
-- clause. Adding a raw subquery (SELECT tenancy_id FROM tenancy_tenants WHERE
-- tenant_id = current_tenant_id()) would re-enter the tenancy_tenants policy
-- and risk a cycle.
--
-- Fix: SECURITY DEFINER function that reads tenancy_tenants as postgres
-- (bypassing RLS), returning only the tenancy IDs the calling tenant is
-- linked to. The tenancies policy adds OR id = ANY(current_tenant_tenancy_ids()).

CREATE OR REPLACE FUNCTION current_tenant_tenancy_ids()
RETURNS SETOF UUID AS $$
  SELECT tt.tenancy_id
  FROM tenancy_tenants tt
  JOIN tenants t ON t.id = tt.tenant_id
  WHERE t.auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Rebuild tenancies policy to include the tenant self-read branch

DROP POLICY IF EXISTS "tenancies_by_landlord" ON tenancies;

CREATE POLICY "tenancies_by_landlord" ON tenancies
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
    OR landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR id = ANY(SELECT current_tenant_tenancy_ids())
  );
