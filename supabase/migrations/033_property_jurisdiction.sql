-- Add jurisdiction column to properties table.
-- Defaults to 'scotland' to match existing data (all current properties are Scottish).
-- Values: 'scotland' | 'england_wales'
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'scotland'
  CHECK (jurisdiction IN ('scotland', 'england_wales'));

-- Comment for clarity
COMMENT ON COLUMN properties.jurisdiction IS 'Jurisdiction governing tenancy law for this property: scotland or england_wales';
