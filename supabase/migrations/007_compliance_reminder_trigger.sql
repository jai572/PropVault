-- Phase 2 Step 8: Compliance reminder auto-generation
--
-- Trigger fires AFTER INSERT OR UPDATE on properties.
-- Creates or refreshes pending reminders for:
--   gas_safety, eicr, epc (always)
--   hmo_licence (only when is_hmo = true)
--
-- due_date logic:
--   If expiry date is known: due_date = expiry_date - 60 days
--   If expiry date is NULL:  due_date = CURRENT_DATE (needs attention now)
--
-- On UPDATE: existing pending reminders for the property are replaced.
-- sent/dismissed reminders are never touched.

CREATE OR REPLACE FUNCTION generate_compliance_reminders()
RETURNS TRIGGER AS $$
DECLARE
  v_gas_due    DATE;
  v_eicr_due   DATE;
  v_epc_due    DATE;
  v_hmo_due    DATE;
BEGIN
  -- Calculate due dates
  v_gas_due  := COALESCE(NEW.gas_safety_expiry - INTERVAL '60 days', CURRENT_DATE)::DATE;
  v_eicr_due := COALESCE(NEW.eicr_expiry       - INTERVAL '60 days', CURRENT_DATE)::DATE;
  v_epc_due  := COALESCE(NEW.epc_expiry        - INTERVAL '60 days', CURRENT_DATE)::DATE;

  -- Remove any existing pending reminders for this property
  -- (sent/dismissed are retained as audit trail)
  DELETE FROM reminders
  WHERE property_id = NEW.id
    AND status = 'pending'
    AND type IN ('gas_safety', 'eicr', 'epc', 'hmo_licence');

  -- Gas safety
  INSERT INTO reminders (property_id, type, due_date, status)
  VALUES (NEW.id, 'gas_safety', v_gas_due, 'pending');

  -- EICR
  INSERT INTO reminders (property_id, type, due_date, status)
  VALUES (NEW.id, 'eicr', v_eicr_due, 'pending');

  -- EPC
  INSERT INTO reminders (property_id, type, due_date, status)
  VALUES (NEW.id, 'epc', v_epc_due, 'pending');

  -- HMO licence (only if is_hmo = true)
  IF NEW.is_hmo = TRUE THEN
    v_hmo_due := COALESCE(NEW.hmo_licence_expiry - INTERVAL '60 days', CURRENT_DATE)::DATE;
    INSERT INTO reminders (property_id, type, due_date, status)
    VALUES (NEW.id, 'hmo_licence', v_hmo_due, 'pending');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to properties table
CREATE TRIGGER trg_compliance_reminders
AFTER INSERT OR UPDATE OF gas_safety_expiry, eicr_expiry, epc_expiry, hmo_licence_expiry, is_hmo
ON properties
FOR EACH ROW
EXECUTE FUNCTION generate_compliance_reminders();

-- ============================================================
-- Backfill: generate reminders for the 12 existing properties
-- ============================================================
-- Trigger only fires on future INSERT/UPDATE so we backfill manually.
-- All existing properties have NULL expiry dates, so due_date = CURRENT_DATE.

INSERT INTO reminders (property_id, type, due_date, status)
SELECT id, 'gas_safety', CURRENT_DATE, 'pending' FROM properties;

INSERT INTO reminders (property_id, type, due_date, status)
SELECT id, 'eicr', CURRENT_DATE, 'pending' FROM properties;

INSERT INTO reminders (property_id, type, due_date, status)
SELECT id, 'epc', CURRENT_DATE, 'pending' FROM properties;

-- HMO licence only for HMO properties
INSERT INTO reminders (property_id, type, due_date, status)
SELECT id, 'hmo_licence', CURRENT_DATE, 'pending'
FROM properties
WHERE is_hmo = TRUE;
