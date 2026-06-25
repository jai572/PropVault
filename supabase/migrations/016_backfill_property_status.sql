-- Migration 016: backfill property status based on active tenancies
--
-- Properties with one or more active tenancies → 'occupied'
-- Properties with no active tenancies         → 'available'
-- Properties in 'maintenance' or 'asset' status are left untouched.

UPDATE properties
SET status = 'occupied'
WHERE id IN (
  SELECT DISTINCT property_id
  FROM tenancies
  WHERE status = 'active'
)
AND status NOT IN ('maintenance', 'asset');

UPDATE properties
SET status = 'available'
WHERE id NOT IN (
  SELECT DISTINCT property_id
  FROM tenancies
  WHERE status = 'active'
)
AND status NOT IN ('maintenance', 'asset');
