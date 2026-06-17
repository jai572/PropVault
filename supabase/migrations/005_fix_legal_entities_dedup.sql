-- Fix duplicate legal_entities rows caused by running 002 seed more than once.
-- Keeps one row per name (the earliest created_at) and deletes duplicates.
-- Then adds a UNIQUE constraint on name to prevent recurrence.

-- Step 1: delete duplicate rows, keeping earliest per name
DELETE FROM legal_entities
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM legal_entities
  ORDER BY name, created_at ASC
);

-- Step 2: prevent duplicates in future
ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_name_unique UNIQUE (name);
