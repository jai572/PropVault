-- Migration 026: owner account for jaimeek.bhalani@googlemail.com
--
-- Creates a users row with role='owner' linked to the four real legal entities.
-- The super_admin row (same email) is left untouched and retains no entity links,
-- so the admin panel remains the only way for super_admin to browse portfolio data.
--
-- After running this migration:
--   1. Create a new Supabase auth account (Auth → Users → Invite user) with a
--      dedicated owner email, e.g.  jai@propvault.co.uk
--   2. Run:
--        UPDATE users
--        SET auth_id = (SELECT id FROM auth.users WHERE email = '<owner-email>' LIMIT 1)
--        WHERE email = 'jai.owner@propvault.internal';
--   3. Log in with the owner account to access the portfolio dashboard.
--
-- The four real legal entities are matched by name. If names differ, update
-- the WHERE clauses below before running.

DO $$
DECLARE
  v_owner_id UUID := gen_random_uuid();
BEGIN
  -- Insert the owner users row (no auth_id yet — set after creating auth account)
  INSERT INTO users (id, auth_id, legal_entity_id, name, email, role, status)
  VALUES (
    v_owner_id,
    NULL,
    NULL,
    'Jai Bhalani',
    'jai.owner@propvault.internal',
    'owner',
    'active'
  );

  -- Link to all four real legal entities
  INSERT INTO user_legal_entities (user_id, legal_entity_id)
  SELECT v_owner_id, id FROM legal_entities
  WHERE name IN (
    'J Bhalani',
    'N Bhalani',
    'TJ Property Consultants Ltd',
    'Devarran-II Ltd'
  );

  RAISE NOTICE 'Owner account created: id=%, email=jai.owner@propvault.internal', v_owner_id;
  RAISE NOTICE 'Linked legal entities: %',
    (SELECT string_agg(name, ', ') FROM legal_entities
     WHERE name IN ('J Bhalani','N Bhalani','TJ Property Consultants Ltd','DevArran-II Ltd'));
END $$;
