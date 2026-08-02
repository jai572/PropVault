-- Migration 032: scope mark_overdue_rent_records() to landlord callers only
--
-- The function is SECURITY DEFINER with no caller check, meaning any
-- authenticated user — including a tenant — can call it via RPC and
-- mass-update rent record statuses across all landlords.
--
-- Fix: add a caller guard at the start. If the calling auth.uid() has no
-- rows in user_legal_entities (i.e. they are a tenant or super_admin with
-- no entity links, not a portfolio landlord), return without updating anything.
-- Landlords always have at least one user_legal_entities row.

CREATE OR REPLACE FUNCTION mark_overdue_rent_records()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_legal_entities ule
    JOIN users u ON u.id = ule.user_id
    WHERE u.auth_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  UPDATE rent_records
  SET status = 'overdue'
  WHERE due_date < CURRENT_DATE
    AND status IN ('pending', 'partial');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
