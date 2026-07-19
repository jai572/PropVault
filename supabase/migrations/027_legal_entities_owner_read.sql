-- Migration 027: allow owners/managers to read their own legal entities
--
-- The original legal_entities policy was super_admin-only.
-- After migration 025 introduced user_legal_entities, owner/manager accounts
-- need SELECT access to the legal_entities rows they are linked to so that
-- PostgREST embedded joins (e.g. properties.select('*, legal_entities(name)'))
-- return data instead of null.

CREATE POLICY "legal_entities_own_read" ON legal_entities
  FOR SELECT USING (
    id = ANY(SELECT current_user_legal_entity_ids())
  );
