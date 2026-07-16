-- Migration 023: break the tenancy_tenants ↔ tenancies RLS cycle
--
-- Remaining cycle after migration 021:
--   tenancy_tenants policy branch 1 → SELECT FROM tenancies (RLS applied)
--   tenancies policy branch 3       → SELECT FROM tenancy_tenants (RLS applied)
--   tenancy_tenants policy branch 1 → ...
--
-- Fix: introduce current_landlord_tenancy_ids() as SECURITY DEFINER so the
-- tenancy_tenants policy can resolve the landlord's tenancies without triggering
-- the tenancies RLS policy, breaking the cycle.

CREATE OR REPLACE FUNCTION current_landlord_tenancy_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM tenancies
  WHERE landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Rebuild tenancy_tenants policy using the new function instead of the
-- tenancies subquery that caused the cycle.
DROP POLICY IF EXISTS "tenancy_tenants_by_landlord" ON tenancy_tenants;

CREATE POLICY "tenancy_tenants_by_landlord" ON tenancy_tenants
  FOR ALL USING (
    tenancy_id = ANY(SELECT current_landlord_tenancy_ids())
    OR current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );
