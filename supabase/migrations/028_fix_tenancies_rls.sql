-- Migration 028: fix tenancies RLS policy
--
-- Migration 025 wrote a tenancies policy that checked:
--   landlord_id IN (SELECT users linked to the owner's legal entities)
--
-- This fails when the tenancy's landlord_id points to a user (e.g. super_admin)
-- who has no legal entity links themselves. The correct join is through the
-- property the tenancy belongs to:
--   property_id IN (SELECT properties WHERE legal_entity_id IN owner's entities)
--
-- This matches the same logic used for properties, documents, and other tables.

DROP POLICY IF EXISTS "tenancies_by_landlord" ON tenancies;

CREATE POLICY "tenancies_by_landlord" ON tenancies
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = ANY(SELECT current_user_legal_entity_ids())
    )
    OR current_user_role() = 'super_admin'
    OR landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );
