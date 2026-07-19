-- Migration 025: user_legal_entities junction table
--
-- Replaces the single users.legal_entity_id FK with a many-to-many junction
-- so one user (e.g. an owner) can be linked to multiple legal entities.
--
-- Steps:
-- 1. Create user_legal_entities junction table.
-- 2. Migrate existing users.legal_entity_id data to the junction.
-- 3. Replace current_user_legal_entity_id() with current_user_legal_entity_ids()
--    returning SETOF UUID (SECURITY DEFINER, reads junction table).
-- 4. Re-create every RLS policy that referenced current_user_legal_entity_id()
--    to use = ANY(current_user_legal_entity_ids()).
-- NOTE: users.legal_entity_id is NOT dropped; it stays for any external
--       tooling, but the app and RLS policies now use the junction table.

-- ── 1. Junction table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_legal_entities (
  user_id         UUID NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, legal_entity_id)
);

ALTER TABLE user_legal_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_legal_entities_super_admin" ON user_legal_entities
  FOR ALL USING (current_user_role() = 'super_admin');

CREATE POLICY "user_legal_entities_own" ON user_legal_entities
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 2. Migrate existing users.legal_entity_id → junction ─────────────────────

INSERT INTO user_legal_entities (user_id, legal_entity_id)
SELECT id, legal_entity_id
FROM users
WHERE legal_entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 3. New helper function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_user_legal_entity_ids()
RETURNS SETOF UUID AS $$
  SELECT ule.legal_entity_id
  FROM user_legal_entities ule
  JOIN users u ON u.id = ule.user_id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Keep old scalar helper for any code still using it — now returns first match.
CREATE OR REPLACE FUNCTION current_user_legal_entity_id()
RETURNS UUID AS $$
  SELECT current_user_legal_entity_ids() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 4. Re-create RLS policies using = ANY(current_user_legal_entity_ids()) ────

-- properties
DROP POLICY IF EXISTS "properties_by_legal_entity" ON properties;
CREATE POLICY "properties_by_legal_entity" ON properties
  FOR ALL USING (
    legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    OR current_user_role() = 'super_admin'
  );

-- tenancies
DROP POLICY IF EXISTS "tenancies_by_landlord" ON tenancies;
CREATE POLICY "tenancies_by_landlord" ON tenancies
  FOR ALL USING (
    landlord_id IN (
      SELECT u.id FROM users u
      WHERE u.legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
         OR u.id IN (SELECT user_id FROM user_legal_entities WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids()))
    )
    OR current_user_role() = 'super_admin'
    OR landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- tenants (via tenancy → legal_entity_id)
DROP POLICY IF EXISTS "tenants_by_legal_entity" ON tenants;
CREATE POLICY "tenants_by_legal_entity" ON tenants
  FOR ALL USING (
    id IN (
      SELECT tt.tenant_id FROM tenancy_tenants tt
      JOIN tenancies t ON t.id = tt.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "tenants_self_read" ON tenants;
CREATE POLICY "tenants_self_read" ON tenants
  FOR SELECT USING (id = current_tenant_id());

-- documents (via tenancy or direct property)
DROP POLICY IF EXISTS "documents_by_legal_entity" ON documents;
CREATE POLICY "documents_by_legal_entity" ON documents
  FOR ALL USING (
    tenancy_id IN (
      SELECT t.id FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
  );

-- viewing_jobs (via property → legal_entity_id)
DROP POLICY IF EXISTS "viewing_jobs_by_legal_entity" ON viewing_jobs;
CREATE POLICY "viewing_jobs_by_legal_entity" ON viewing_jobs
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
  );

-- maintenance_jobs (via property → legal_entity_id)
DROP POLICY IF EXISTS "maintenance_jobs_by_legal_entity" ON maintenance_jobs;
CREATE POLICY "maintenance_jobs_by_legal_entity" ON maintenance_jobs
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
  );

-- communications (via tenancy → property → legal_entity_id)
DROP POLICY IF EXISTS "communications_by_legal_entity" ON communications;
CREATE POLICY "communications_by_legal_entity" ON communications
  FOR ALL USING (
    tenancy_id IN (
      SELECT t.id FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
  );

-- property_facilities (from migration 013)
DROP POLICY IF EXISTS "facilities_by_legal_entity" ON property_facilities;
CREATE POLICY "facilities_by_legal_entity" ON property_facilities
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
  );

-- rent_records (already uses current_landlord_tenancy_ids; no change needed)
-- tenancy_tenants (already uses current_landlord_tenancy_ids; no change needed)
