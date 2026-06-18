-- Migration 012: Add contact details to legal_entities; seed addresses and registration numbers

ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT;

-- Seed TJ Property Consultants Ltd
UPDATE legal_entities
SET
  address = '70 Victoria Road, Aberdeen, AB11 9DS',
  landlord_registration_number = '591846/100/19091',
  email = 'tjpropertyconsultants@gmail.com',
  telephone = '07877677753'
WHERE name = 'TJ Property Consultants Ltd';

-- Seed J Bhalani
UPDATE legal_entities
SET
  address = '26A Fraser Road, Aberdeen, AB25 3UH',
  landlord_registration_number = '397729/100/19051'
WHERE name = 'J Bhalani';

-- Seed N Bhalani
UPDATE legal_entities
SET
  address = '26A Fraser Road, Aberdeen, AB25 3UH',
  landlord_registration_number = '994627/100/11021'
WHERE name = 'N Bhalani';
