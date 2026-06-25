-- Migration 015: deposit resolution fields + closure reason on tenancies

ALTER TABLE tenancies
  -- Deposit resolution
  ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (deposit_status IN ('pending', 'refunded', 'retained', 'disputed')),
  ADD COLUMN IF NOT EXISTS deposit_refund_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deposit_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS deposit_resolved_at TIMESTAMPTZ,
  -- Closure
  ADD COLUMN IF NOT EXISTS closure_reason TEXT
    CHECK (closure_reason IN ('tenant_notice', 'landlord_notice', 'mutual_agreement', 'other')),
  ADD COLUMN IF NOT EXISTS closure_reason_other TEXT,
  ADD COLUMN IF NOT EXISTS closure_notes TEXT;
