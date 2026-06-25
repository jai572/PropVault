-- Migration 014: add link_expires_at to tenants
-- Tracks expiry independently of created_at so links can be extended without
-- touching the audit-relevant creation timestamp.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS link_expires_at TIMESTAMPTZ;
