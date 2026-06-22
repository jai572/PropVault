-- Migration 013: property_facilities — per-property included/shared/excluded facilities for PRT

CREATE TABLE property_facilities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  facility_name TEXT       NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('included', 'shared', 'excluded')),
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX property_facilities_property_id_idx ON property_facilities (property_id, sort_order);

ALTER TABLE property_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_facilities_select" ON property_facilities
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
         OR current_user_role() = 'super_admin'
    )
  );

CREATE POLICY "property_facilities_insert" ON property_facilities
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
         OR current_user_role() = 'super_admin'
    )
  );

CREATE POLICY "property_facilities_delete" ON property_facilities
  FOR DELETE USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
         OR current_user_role() = 'super_admin'
    )
  );
