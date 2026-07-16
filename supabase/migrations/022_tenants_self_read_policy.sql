-- Migration 022: give tenants a clean self-read path on the tenants table
--
-- Problem: tenants_by_legal_entity (migration 001) has three OR branches:
--   1. id IN (SELECT ... FROM tenancy_tenants JOIN tenancies JOIN properties ...)
--   2. current_user_role() = 'super_admin'
--   3. auth_id = auth.uid()
--
-- PostgreSQL evaluates ALL branches of an OR in a RLS policy (no short-circuit).
-- Branch 1 queries tenancy_tenants (RLS-protected). The tenancy_tenants policy
-- calls current_tenant_id() which queries tenants bypassing RLS — that is safe.
-- But the overall evaluation chain is deep and can surface errors before branch 3
-- (the simple self-read) is considered.
--
-- Fix: split the tenant self-read into a dedicated policy using SECURITY DEFINER
-- so the self-check is isolated from the landlord join path.

-- Drop the existing combined policy and rebuild it without the tenant OR clause.
DROP POLICY IF EXISTS "tenants_by_legal_entity" ON tenants;

CREATE POLICY "tenants_by_legal_entity" ON tenants
  FOR ALL USING (
    id IN (
      SELECT tt.tenant_id FROM tenancy_tenants tt
      JOIN tenancies t ON t.id = tt.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
  );

-- Dedicated self-read policy for tenant sessions.
-- current_tenant_id() is SECURITY DEFINER (migration 021) so it reads the
-- tenants table without triggering RLS, breaking any potential recursion.
DROP POLICY IF EXISTS "tenants_self_read" ON tenants;

CREATE POLICY "tenants_self_read" ON tenants
  FOR SELECT USING (
    id = current_tenant_id()
  );
