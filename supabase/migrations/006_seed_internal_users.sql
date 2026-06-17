-- Seed internal user: Jai Bhalani — super_admin
-- Looks up auth_id from auth.users by email — no hardcoded UUID
-- legal_entity_id is NULL for super_admin (access spans all entities)

INSERT INTO users (auth_id, legal_entity_id, name, email, role, status)
SELECT
  au.id,
  NULL,
  'Jai Bhalani',
  'jaimeek.bhalani@googlemail.com',
  'super_admin',
  'active'
FROM auth.users au
WHERE au.email = 'jaimeek.bhalani@googlemail.com'
ON CONFLICT (email) DO NOTHING;
