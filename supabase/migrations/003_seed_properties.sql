-- PropVault Seed — Properties (12 portfolio properties)
-- Phase 1 Step 3
-- Legal entities referenced by name subquery — LIMIT 1 on each to guard against duplicates
-- city = Aberdeen for all (AB postcodes confirm this)
-- 47 Constitution St and 440 George St excluded — removed from portfolio

INSERT INTO properties (
  legal_entity_id,
  address_line_1,
  address_line_2,
  city,
  postcode,
  property_type,
  bedrooms,
  is_hmo,
  status
)
VALUES

-- 1. J Bhalani — 1 bed studio
(
  (SELECT id FROM legal_entities WHERE name = 'J Bhalani' LIMIT 1),
  '46 King St',
  NULL,
  'Aberdeen',
  'AB24 5AX',
  'studio',
  1,
  FALSE,
  'available'
),

-- 2. J Bhalani — 2 bed apartment
(
  (SELECT id FROM legal_entities WHERE name = 'J Bhalani' LIMIT 1),
  '26A Fraser Road',
  NULL,
  'Aberdeen',
  'AB25 3UH',
  'apartment',
  2,
  FALSE,
  'available'
),

-- 3. TJ Property Consultants Ltd — 2 bed studio
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd' LIMIT 1),
  '470 George St',
  NULL,
  'Aberdeen',
  'AB25 3XH',
  'studio',
  2,
  FALSE,
  'available'
),

-- 4. TJ Property Consultants Ltd — 3 bed HMO
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd' LIMIT 1),
  '41E Froghall Road',
  NULL,
  'Aberdeen',
  'AB24 3JL',
  'flat',
  3,
  TRUE,
  'available'
),

-- 5. TJ Property Consultants Ltd — 3 bed HMO
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd' LIMIT 1),
  '43A Froghall Road',
  NULL,
  'Aberdeen',
  'AB24 3JL',
  'flat',
  3,
  TRUE,
  'available'
),

-- 6. TJ Property Consultants Ltd — 3 bed HMO
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd' LIMIT 1),
  '41A Froghall Road',
  NULL,
  'Aberdeen',
  'AB24 3JL',
  'flat',
  3,
  TRUE,
  'available'
),

-- 7. TJ Property Consultants Ltd — 2 bed apartment
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd' LIMIT 1),
  '534 George Street',
  NULL,
  'Aberdeen',
  'AB25 3XL',
  'apartment',
  2,
  FALSE,
  'available'
),

-- 8. TJ Property Consultants Ltd — 2 bed apartment
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd' LIMIT 1),
  '43H St Anns Court',
  NULL,
  'Aberdeen',
  'AB24 3AX',
  'apartment',
  2,
  FALSE,
  'available'
),

-- 9. Devarran-II Ltd — Studio, Basement Left
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd' LIMIT 1),
  '16 Merkland Road',
  'Basement Left',
  'Aberdeen',
  'AB24 5PR',
  'studio',
  NULL,
  FALSE,
  'available'
),

-- 10. Devarran-II Ltd — Studio, Basement Right
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd' LIMIT 1),
  '16 Merkland Road',
  'Basement Right',
  'Aberdeen',
  'AB24 5PR',
  'studio',
  NULL,
  FALSE,
  'available'
),

-- 11. Devarran-II Ltd — 1 bed flat, Ground Floor Right
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd' LIMIT 1),
  '16 Merkland Road',
  'Ground Floor Right',
  'Aberdeen',
  'AB24 5PR',
  'flat',
  1,
  FALSE,
  'available'
),

-- 12. N Bhalani — 1 bed apartment
(
  (SELECT id FROM legal_entities WHERE name = 'N Bhalani' LIMIT 1),
  '84C King Street',
  NULL,
  'Aberdeen',
  'AB24 5BA',
  'apartment',
  1,
  FALSE,
  'available'
);
