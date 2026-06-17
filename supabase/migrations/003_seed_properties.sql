-- PropVault Seed — Properties (14 portfolio properties)
-- Phase 1 Step 3
-- Legal entities referenced by name subquery — no hardcoded UUIDs
-- city = Aberdeen for all (AB postcodes confirm this)
-- Postcodes marked 'TBC' where not provided in seed data — update once confirmed

INSERT INTO properties (
  legal_entity_id,
  address_line_1,
  city,
  postcode,
  property_type,
  bedrooms,
  is_hmo,
  status
)
VALUES

-- 1. J Bhalani
(
  (SELECT id FROM legal_entities WHERE name = 'J Bhalani'),
  '46 King St',
  'Aberdeen',
  'AB24 5AX',
  'studio',
  1,
  FALSE,
  'available'
),

-- 2. J Bhalani
(
  (SELECT id FROM legal_entities WHERE name = 'J Bhalani'),
  '26A Fraser Road',
  'Aberdeen',
  'AB25 3UH',
  'apartment',
  2,
  FALSE,
  'available'
),

-- 3. TJ Property Consultants Ltd
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '470 George St',
  'Aberdeen',
  'AB25 3BH',
  'studio',
  2,
  FALSE,
  'available'
),

-- 4. TJ Property Consultants Ltd — HMO
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '41E Froghall Road',
  'Aberdeen',
  'AB24 3JL',
  'flat',
  3,
  TRUE,
  'available'
),

-- 5. TJ Property Consultants Ltd — HMO
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '43A Froghall Road',
  'Aberdeen',
  'AB24 3JL',
  'flat',
  3,
  TRUE,
  'available'
),

-- 6. TJ Property Consultants Ltd — HMO
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '41A Froghall Road',
  'Aberdeen',
  'AB24 3JL',
  'flat',
  3,
  TRUE,
  'available'
),

-- 7. TJ Property Consultants Ltd
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '534 George Street',
  'Aberdeen',
  'AB25 3BH',
  'apartment',
  2,
  FALSE,
  'available'
),

-- 8. TJ Property Consultants Ltd
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '43H St Anns Court',
  'Aberdeen',
  'AB24 3AX',
  'apartment',
  2,
  FALSE,
  'available'
),

-- 9. TJ Property Consultants Ltd — Plot of land, status = asset
(
  (SELECT id FROM legal_entities WHERE name = 'TJ Property Consultants Ltd'),
  '47 Constitution St',
  'Aberdeen',
  'TBC',
  'land',
  NULL,
  FALSE,
  'asset'
),

-- 10. Devarran-II Ltd
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd'),
  '16 Merkland Road',
  'Aberdeen',
  'TBC',
  'studio',
  NULL,
  FALSE,
  'available'
),

-- 11. Devarran-II Ltd
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd'),
  '16 Merkland Road',
  'Aberdeen',
  'TBC',
  'studio',
  NULL,
  FALSE,
  'available'
),

-- 12. Devarran-II Ltd
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd'),
  '16 Merkland Road',
  'Aberdeen',
  'TBC',
  'flat',
  1,
  FALSE,
  'available'
),

-- 13. Devarran-II Ltd — HMO
(
  (SELECT id FROM legal_entities WHERE name = 'Devarran-II Ltd'),
  '440 George St',
  'Aberdeen',
  'TBC',
  'flat',
  3,
  TRUE,
  'available'
),

-- 14. N Bhalani
(
  (SELECT id FROM legal_entities WHERE name = 'N Bhalani'),
  '84C King Street',
  'Aberdeen',
  'TBC',
  'apartment',
  1,
  FALSE,
  'available'
);
