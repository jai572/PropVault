-- Migration 020: extend RLS policies so authenticated tenants can read
-- their own tenancy_tenants, tenancies, and documents rows via the portal.
--
-- Root cause: tenancy_tenants_by_landlord, tenancies_by_landlord, and
-- documents_by_legal_entity only granted access via the landlord users
-- table. A tenant auth session has no row in public.users, so all three
-- queries returned zero rows and the portal dashboard showed
-- "No active tenancy found for your account."

-- ── tenancies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenancies_by_landlord" ON tenancies;

CREATE POLICY "tenancies_by_landlord" ON tenancies
  FOR ALL USING (
    landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR current_user_role() = 'super_admin'
    -- tenant can read their own tenancy
    OR id IN (
      SELECT tt.tenancy_id FROM tenancy_tenants tt
      JOIN tenants ten ON ten.id = tt.tenant_id
      WHERE ten.auth_id = auth.uid()
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
    -- tenant can read the row linking them to their tenancy
    OR tenant_id = (SELECT id FROM tenants WHERE auth_id = auth.uid() LIMIT 1)
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
    -- tenant can read documents for their own tenancy (PRT, deposit cert)
    OR tenancy_id IN (
      SELECT tt.tenancy_id FROM tenancy_tenants tt
      JOIN tenants ten ON ten.id = tt.tenant_id
      WHERE ten.auth_id = auth.uid()
    )
  );
