-- Migration 024: rent tracking foundation
--
-- 1. Patch rent_records table (already created in 001) to add notes column
--    and set DEFAULT 0 on amount_paid.
-- 2. Fix RLS policy to use current_landlord_tenancy_ids() SECURITY DEFINER
--    (avoids tenancy_tenants ↔ tenancies recursion introduced in 023).
-- 3. Add generate_rent_records() trigger function + trigger on tenancies.
-- 4. Add mark_overdue_rent_records() helper called on-read.
-- 5. Backfill: generate records for all existing active tenancies.

-- ── 1. Schema patch ───────────────────────────────────────────────────────────

ALTER TABLE rent_records
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ALTER COLUMN amount_paid SET DEFAULT 0;

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rent_records_by_landlord" ON rent_records;

CREATE POLICY "rent_records_by_landlord" ON rent_records
  FOR ALL USING (
    tenancy_id = ANY(SELECT current_landlord_tenancy_ids())
    OR current_user_role() = 'super_admin'
  );

-- ── 3. Auto-generation trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_rent_records()
RETURNS TRIGGER AS $$
DECLARE
  i         INTEGER;
  first_due DATE;
  due       DATE;
BEGIN
  -- First due date: rent_due_day of the start month.
  -- If that day has already passed relative to start_date, push to next month.
  first_due := DATE_TRUNC('month', NEW.start_date)
               + (NEW.rent_due_day - 1) * INTERVAL '1 day';

  IF first_due < NEW.start_date THEN
    first_due := DATE_TRUNC('month', NEW.start_date)
                 + INTERVAL '1 month'
                 + (NEW.rent_due_day - 1) * INTERVAL '1 day';
  END IF;

  FOR i IN 0..11 LOOP
    due := first_due + (i || ' months')::INTERVAL;
    INSERT INTO rent_records (tenancy_id, due_date, amount_due, amount_paid, status)
    VALUES (NEW.id, due, NEW.rent_amount, 0, 'pending')
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_rent_records ON tenancies;

CREATE TRIGGER trg_generate_rent_records
  AFTER INSERT ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION generate_rent_records();

-- ── 4. Overdue flagging helper ────────────────────────────────────────────────
-- Call this via RPC before fetching rent_records to ensure statuses are current.

CREATE OR REPLACE FUNCTION mark_overdue_rent_records()
RETURNS void AS $$
  UPDATE rent_records
  SET status = 'overdue'
  WHERE due_date < CURRENT_DATE
    AND status IN ('pending', 'partial');
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 5. Backfill existing active tenancies ─────────────────────────────────────

DO $$
DECLARE
  t         RECORD;
  i         INTEGER;
  first_due DATE;
  due       DATE;
BEGIN
  FOR t IN
    SELECT id, start_date, rent_amount, rent_due_day
    FROM tenancies
    WHERE status = 'active'
  LOOP
    -- Skip if records already exist for this tenancy
    IF EXISTS (SELECT 1 FROM rent_records WHERE tenancy_id = t.id LIMIT 1) THEN
      CONTINUE;
    END IF;

    first_due := DATE_TRUNC('month', t.start_date)
                 + (t.rent_due_day - 1) * INTERVAL '1 day';

    IF first_due < t.start_date THEN
      first_due := DATE_TRUNC('month', t.start_date)
                   + INTERVAL '1 month'
                   + (t.rent_due_day - 1) * INTERVAL '1 day';
    END IF;

    FOR i IN 0..11 LOOP
      due := first_due + (i || ' months')::INTERVAL;
      INSERT INTO rent_records (tenancy_id, due_date, amount_due, amount_paid, status)
      VALUES (t.id, due, t.rent_amount, 0, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
