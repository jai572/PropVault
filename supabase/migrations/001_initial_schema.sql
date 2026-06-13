-- PropVault Schema v1 — Initial Migration
-- Run this in the Supabase SQL editor in one transaction

BEGIN;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. legal_entities
CREATE TABLE legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('individual', 'company')),
  landlord_registration_number TEXT,
  council_area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id),
  legal_entity_id UUID REFERENCES legal_entities(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'owner', 'manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  property_type TEXT,
  bedrooms INTEGER,
  is_hmo BOOLEAN DEFAULT FALSE,
  hmo_licence_number TEXT,
  hmo_licence_expiry DATE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'asset')),
  epc_expiry DATE,
  gas_safety_expiry DATE,
  eicr_expiry DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_legal_entity ON properties(legal_entity_id);

-- 4. contractors
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  trade TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. viewing_agents
CREATE TABLE viewing_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. viewing_jobs
CREATE TABLE viewing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  viewing_agent_id UUID REFERENCES viewing_agents(id),
  prospective_tenant_name TEXT,
  prospective_tenant_email TEXT,
  prospective_tenant_phone TEXT,
  scheduled_datetime TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'completed', 'cancelled', 'no_show')),
  outcome TEXT CHECK (outcome IN ('interested', 'not_interested', 'no_show')),
  agent_notes TEXT,
  unique_link_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_viewing_jobs_status ON viewing_jobs(status);
CREATE INDEX idx_viewing_jobs_property ON viewing_jobs(property_id);

-- 7. tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'prospective' CHECK (status IN ('prospective', 'active', 'closed', 'purged')),
  right_to_rent_verified BOOLEAN DEFAULT FALSE,
  right_to_rent_checked_date DATE,
  right_to_rent_document_type TEXT,
  right_to_rent_expiry DATE,
  unique_link_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_status ON tenants(status);

-- 8. tenancies
CREATE TABLE tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_reference TEXT UNIQUE NOT NULL,
  property_id UUID NOT NULL REFERENCES properties(id),
  landlord_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  start_date DATE NOT NULL,
  end_date DATE,
  rent_amount NUMERIC(10,2) NOT NULL,
  rent_due_day INTEGER NOT NULL CHECK (rent_due_day BETWEEN 1 AND 28),
  deposit_amount NUMERIC(10,2),
  deposit_scheme TEXT,
  deposit_reference TEXT,
  room_reference TEXT,
  jurisdiction TEXT NOT NULL DEFAULT 'scotland' CHECK (jurisdiction IN ('scotland', 'england_wales')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_tenancies_status ON tenancies(status);
CREATE INDEX idx_tenancies_property ON tenancies(property_id);
CREATE INDEX idx_tenancies_reference ON tenancies(tenancy_reference);

-- Auto-generate tenancy_reference: PV-[YEAR]-[SEQUENCE]
CREATE SEQUENCE tenancy_sequence START 1;

CREATE OR REPLACE FUNCTION generate_tenancy_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenancy_reference IS NULL OR NEW.tenancy_reference = '' THEN
    NEW.tenancy_reference := 'PV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('tenancy_sequence')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tenancy_reference
BEFORE INSERT ON tenancies
FOR EACH ROW EXECUTE FUNCTION generate_tenancy_reference();

-- 9. tenancy_tenants
CREATE TABLE tenancy_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  is_lead_tenant BOOLEAN DEFAULT FALSE,
  UNIQUE(tenancy_id, tenant_id)
);

-- 10. documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID REFERENCES tenancies(id),
  property_id UUID REFERENCES properties(id),
  type TEXT NOT NULL CHECK (type IN (
    'PRT', 'EPC', 'gas_safety', 'EICR',
    'right_to_rent', 'compliance_pack',
    'tenancy_summary', 'other'
  )),
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  delivered_to_tenant BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_tenancy ON documents(tenancy_id);

-- 11. rent_records
CREATE TABLE rent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  due_date DATE NOT NULL,
  amount_due NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2),
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rent_records_status ON rent_records(status);
CREATE INDEX idx_rent_records_due_date ON rent_records(due_date);
CREATE INDEX idx_rent_records_tenancy ON rent_records(tenancy_id);

-- 12. communications
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('landlord', 'tenant')),
  sender_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('general_message', 'maintenance_report')),
  body TEXT NOT NULL,
  photo_url TEXT,
  maintenance_category TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communications_type ON communications(type);
CREATE INDEX idx_communications_status ON communications(status);
CREATE INDEX idx_communications_tenancy ON communications(tenancy_id);

-- 13. maintenance_jobs
CREATE TABLE maintenance_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  contractor_id UUID REFERENCES contractors(id),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'assigned', 'completed')),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_photo_url TEXT,
  landlord_notes TEXT,
  unique_link_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_jobs_status ON maintenance_jobs(status);

-- 14. notices
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  landlord_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('late_rent', 'notice_to_leave')),
  ground_number INTEGER CHECK (ground_number BETWEEN 1 AND 18),
  body TEXT NOT NULL,
  issued_date DATE NOT NULL,
  file_url TEXT,
  disclaimer_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  disclaimer_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notices_type ON notices(type);
CREATE INDEX idx_notices_tenancy ON notices(tenancy_id);

-- 15. reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),
  type TEXT NOT NULL CHECK (type IN (
    'gas_safety', 'eicr', 'epc',
    'deposit_lodgement', 'council_tax',
    'right_to_rent', 'rent_due', 'hmo_licence'
  )),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_reminders_due_date ON reminders(due_date);

-- 16. meter_readings
CREATE TABLE meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  type TEXT NOT NULL CHECK (type IN ('entry', 'exit')),
  gas_reading NUMERIC(10,2),
  electricity_reading NUMERIC(10,2),
  photo_url TEXT,
  submitted_by_user UUID REFERENCES users(id),
  submitted_by_tenant UUID REFERENCES tenants(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meter_readings_tenancy ON meter_readings(tenancy_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role and legal_entity_id from users table
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_legal_entity_id()
RETURNS UUID AS $$
  SELECT legal_entity_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- legal_entities: super_admin only
CREATE POLICY "legal_entities_super_admin" ON legal_entities
  FOR ALL USING (current_user_role() = 'super_admin');

-- users: own record or super_admin
CREATE POLICY "users_own_or_super_admin" ON users
  FOR ALL USING (
    auth_id = auth.uid()
    OR current_user_role() = 'super_admin'
  );

-- properties: legal_entity_id match or super_admin
CREATE POLICY "properties_by_legal_entity" ON properties
  FOR ALL USING (
    legal_entity_id = current_user_legal_entity_id()
    OR current_user_role() = 'super_admin'
  );

-- contractors: landlord_id match or super_admin
CREATE POLICY "contractors_by_landlord" ON contractors
  FOR ALL USING (
    landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR current_user_role() = 'super_admin'
  );

-- viewing_agents: landlord_id match or super_admin
CREATE POLICY "viewing_agents_by_landlord" ON viewing_agents
  FOR ALL USING (
    landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR current_user_role() = 'super_admin'
  );

-- viewing_jobs: via property → legal_entity_id
CREATE POLICY "viewing_jobs_by_legal_entity" ON viewing_jobs
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
  );

-- tenants: via tenancy → legal_entity_id
CREATE POLICY "tenants_by_legal_entity" ON tenants
  FOR ALL USING (
    id IN (
      SELECT tt.tenant_id FROM tenancy_tenants tt
      JOIN tenancies t ON t.id = tt.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
    -- allow tenant to see their own record
    OR auth_id = auth.uid()
  );

-- tenancies: landlord_id match or super_admin
CREATE POLICY "tenancies_by_landlord" ON tenancies
  FOR ALL USING (
    landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR current_user_role() = 'super_admin'
  );

-- tenancy_tenants: via tenancy → landlord_id
CREATE POLICY "tenancy_tenants_by_landlord" ON tenancy_tenants
  FOR ALL USING (
    tenancy_id IN (
      SELECT id FROM tenancies
      WHERE landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
    OR current_user_role() = 'super_admin'
  );

-- documents: via tenancy or property → legal_entity_id
CREATE POLICY "documents_by_legal_entity" ON documents
  FOR ALL USING (
    tenancy_id IN (
      SELECT t.id FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = current_user_legal_entity_id()
    )
    OR property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
  );

-- rent_records: via tenancy → landlord_id
CREATE POLICY "rent_records_by_landlord" ON rent_records
  FOR ALL USING (
    tenancy_id IN (
      SELECT id FROM tenancies
      WHERE landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
    OR current_user_role() = 'super_admin'
  );

-- communications: via tenancy → landlord_id, plus tenant own access
CREATE POLICY "communications_by_landlord_or_tenant" ON communications
  FOR ALL USING (
    tenancy_id IN (
      SELECT id FROM tenancies
      WHERE landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
    OR current_user_role() = 'super_admin'
    OR sender_id = (SELECT id FROM tenants WHERE auth_id = auth.uid() LIMIT 1)
    OR tenancy_id IN (
      SELECT tt.tenancy_id FROM tenancy_tenants tt
      JOIN tenants ten ON ten.id = tt.tenant_id
      WHERE ten.auth_id = auth.uid()
    )
  );

-- maintenance_jobs: via property → legal_entity_id
CREATE POLICY "maintenance_jobs_by_legal_entity" ON maintenance_jobs
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
  );

-- notices: landlord_id match or super_admin
CREATE POLICY "notices_by_landlord" ON notices
  FOR ALL USING (
    landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR current_user_role() = 'super_admin'
  );

-- reminders: via property or tenancy → legal_entity_id
CREATE POLICY "reminders_by_legal_entity" ON reminders
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE legal_entity_id = current_user_legal_entity_id()
    )
    OR tenancy_id IN (
      SELECT t.id FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.legal_entity_id = current_user_legal_entity_id()
    )
    OR current_user_role() = 'super_admin'
  );

-- meter_readings: via tenancy → landlord_id
CREATE POLICY "meter_readings_by_landlord" ON meter_readings
  FOR ALL USING (
    tenancy_id IN (
      SELECT id FROM tenancies
      WHERE landlord_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    )
    OR current_user_role() = 'super_admin'
  );

COMMIT;
