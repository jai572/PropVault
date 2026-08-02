-- Migration 031: align tenancy_tenants RLS with the property chain
--
-- The tenancy_tenants_by_landlord policy (migration 023) uses
-- current_landlord_tenancy_ids(), which resolves tenancies by landlord_id.
-- After migration 028 rebuilt the tenancies policy to scope by
-- property_id → properties.legal_entity_id, the two policies diverge:
-- owner accounts whose tenancies carry a legacy landlord_id pointing to
-- the seed super_admin user cannot see tenancy_tenants rows even though
-- the parent tenancy is readable.
--
-- Fix: rebuild the landlord branch to follow the same property chain as
-- the tenancies policy. The cycle that originally forced current_landlord_
-- tenancy_ids() no longer exists because the tenancies policy now resolves
-- its tenant branch via current_tenant_tenancy_ids() (SECURITY DEFINER,
-- migration 030), which reads tenancy_tenants without triggering its RLS.
--
-- Tenant self-read branch (tenant_id = current_tenant_id()) is unchanged.

DROP POLICY IF EXISTS "tenancy_tenants_by_landlord" ON tenancy_tenants;

CREATE POLICY "tenancy_tenants_by_landlord" ON tenancy_tenants
  FOR ALL USING (
    tenancy_id IN (
      SELECT t.id FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );
