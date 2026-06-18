-- Phase 2 Step 8 (amendment): Add has_gas to properties, update trigger, backfill

-- ============================================================
-- 1. Add has_gas column — defaults true for all existing rows
-- ============================================================
ALTER TABLE properties
  ADD COLUMN has_gas BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 2. Set has_gas = false for the 7 properties with no gas supply
-- ============================================================
UPDATE properties SET has_gas = FALSE
WHERE (address_line_1 = '46 King St')
   OR (address_line_1 = '26A Fraser Road')
   OR (address_line_1 = '41E Froghall Road')
   OR (address_line_1 = '43A Froghall Road')
   OR (address_line_1 = '41A Froghall Road')
   OR (address_line_1 = '16 Merkland Road' AND address_line_2 = 'Basement Left')
   OR (address_line_1 = '16 Merkland Road' AND address_line_2 = 'Basement Right');

-- ============================================================
-- 3. Delete existing gas_safety reminders for has_gas = false properties
-- ============================================================
DELETE FROM reminders
WHERE type = 'gas_safety'
  AND property_id IN (
    SELECT id FROM properties WHERE has_gas = FALSE
  );

-- ============================================================
-- 4. Update trigger function to respect has_gas
-- ============================================================
CREATE OR REPLACE FUNCTION generate_compliance_reminders()
RETURNS TRIGGER AS $$
DECLARE
  v_gas_due  DATE;
  v_eicr_due DATE;
  v_epc_due  DATE;
  v_hmo_due  DATE;
BEGIN
  -- Remove existing pending reminders (sent/dismissed retained)
  DELETE FROM reminders
  WHERE property_id = NEW.id
    AND status = 'pending'
    AND type IN ('gas_safety', 'eicr', 'epc', 'hmo_licence');

  -- Gas safety — only when has_gas = true
  IF NEW.has_gas = TRUE THEN
    v_gas_due := COALESCE(NEW.gas_safety_expiry - INTERVAL '60 days', CURRENT_DATE)::DATE;
    INSERT INTO reminders (property_id, type, due_date, status)
    VALUES (NEW.id, 'gas_safety', v_gas_due, 'pending');
  END IF;

  -- EICR
  v_eicr_due := COALESCE(NEW.eicr_expiry - INTERVAL '60 days', CURRENT_DATE)::DATE;
  INSERT INTO reminders (property_id, type, due_date, status)
  VALUES (NEW.id, 'eicr', v_eicr_due, 'pending');

  -- EPC
  v_epc_due := COALESCE(NEW.epc_expiry - INTERVAL '60 days', CURRENT_DATE)::DATE;
  INSERT INTO reminders (property_id, type, due_date, status)
  VALUES (NEW.id, 'epc', v_epc_due, 'pending');

  -- HMO licence — only when is_hmo = true
  IF NEW.is_hmo = TRUE THEN
    v_hmo_due := COALESCE(NEW.hmo_licence_expiry - INTERVAL '60 days', CURRENT_DATE)::DATE;
    INSERT INTO reminders (property_id, type, due_date, status)
    VALUES (NEW.id, 'hmo_licence', v_hmo_due, 'pending');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
