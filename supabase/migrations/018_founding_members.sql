-- Founding-member signups captured from /founding page
CREATE TABLE IF NOT EXISTS founding_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  property_count      TEXT NOT NULL,
  stripe_session_id   TEXT,
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  -- pending | checkout_started | active | cancelled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX founding_members_email_idx ON founding_members (email);
CREATE INDEX founding_members_stripe_session_idx ON founding_members (stripe_session_id);

-- RLS: no client access — server-side only via service role
ALTER TABLE founding_members ENABLE ROW LEVEL SECURITY;
