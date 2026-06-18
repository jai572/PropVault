export interface LegalEntity {
  id: string
  name: string
  type: 'individual' | 'company'
  landlord_registration_number: string | null
  council_area: string | null
  address: string | null
  email: string | null
  telephone: string | null
  created_at: string
}

export interface User {
  id: string
  auth_id: string | null
  legal_entity_id: string | null
  name: string
  email: string
  phone: string | null
  role: 'super_admin' | 'owner' | 'manager'
  status: 'active' | 'inactive'
  created_at: string
}

export interface Property {
  id: string
  legal_entity_id: string
  address_line_1: string
  address_line_2: string | null
  city: string
  postcode: string
  property_type: string | null
  bedrooms: number | null
  is_hmo: boolean
  hmo_licence_number: string | null
  hmo_licence_expiry: string | null
  has_gas: boolean
  status: 'available' | 'occupied' | 'maintenance' | 'asset'
  epc_expiry: string | null
  gas_safety_expiry: string | null
  eicr_expiry: string | null
  created_at: string
}

export interface Contractor {
  id: string
  landlord_id: string
  name: string
  trade: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface ViewingAgent {
  id: string
  landlord_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface ViewingJob {
  id: string
  property_id: string
  viewing_agent_id: string | null
  prospective_tenant_name: string | null
  prospective_tenant_email: string | null
  prospective_tenant_phone: string | null
  scheduled_datetime: string | null
  status: 'assigned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  outcome: 'interested' | 'not_interested' | 'no_show' | null
  agent_notes: string | null
  unique_link_token: string | null
  created_at: string
  completed_at: string | null
}

export interface Tenant {
  id: string
  auth_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: 'prospective' | 'active' | 'closed' | 'purged' | 'withdrawn'
  right_to_rent_verified: boolean
  right_to_rent_checked_date: string | null
  right_to_rent_document_type: string | null
  right_to_rent_expiry: string | null
  unique_link_token: string | null
  created_by_user_id: string | null
  legal_entity_id: string | null
  created_at: string
}

export interface Tenancy {
  id: string
  tenancy_reference: string
  property_id: string
  landlord_id: string
  status: 'active' | 'closed'
  start_date: string
  end_date: string | null
  rent_amount: number
  rent_due_day: number
  deposit_amount: number | null
  deposit_scheme: string | null
  deposit_reference: string | null
  room_reference: string | null
  jurisdiction: 'scotland' | 'england_wales'
  created_at: string
  closed_at: string | null
}

export interface TenancyTenant {
  id: string
  tenancy_id: string
  tenant_id: string
  is_lead_tenant: boolean
}

export interface Document {
  id: string
  tenancy_id: string | null
  property_id: string | null
  type: 'PRT' | 'EPC' | 'gas_safety' | 'EICR' | 'right_to_rent' | 'compliance_pack' | 'tenancy_summary' | 'other'
  file_url: string
  uploaded_by: string | null
  delivered_to_tenant: boolean
  delivered_at: string | null
  created_at: string
}

export interface RentRecord {
  id: string
  tenancy_id: string
  due_date: string
  amount_due: number
  amount_paid: number | null
  paid_date: string | null
  status: 'pending' | 'paid' | 'partial' | 'overdue'
  created_at: string
}

export interface Communication {
  id: string
  tenancy_id: string
  sender_type: 'landlord' | 'tenant'
  sender_id: string
  type: 'general_message' | 'maintenance_report'
  body: string
  photo_url: string | null
  maintenance_category: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
}

export interface MaintenanceJob {
  id: string
  communication_id: string
  property_id: string
  contractor_id: string | null
  status: 'reported' | 'assigned' | 'completed'
  assigned_at: string | null
  completed_at: string | null
  completion_photo_url: string | null
  landlord_notes: string | null
  unique_link_token: string | null
  created_at: string
}

export interface Notice {
  id: string
  tenancy_id: string
  landlord_id: string
  type: 'late_rent' | 'notice_to_leave'
  ground_number: number | null
  body: string
  issued_date: string
  file_url: string | null
  disclaimer_acknowledged: boolean
  disclaimer_acknowledged_at: string | null
  created_at: string
}

export interface Reminder {
  id: string
  property_id: string | null
  tenancy_id: string | null
  type: 'gas_safety' | 'eicr' | 'epc' | 'deposit_lodgement' | 'council_tax' | 'right_to_rent' | 'rent_due' | 'hmo_licence'
  due_date: string
  status: 'pending' | 'sent' | 'dismissed'
  created_at: string
}

export interface MeterReading {
  id: string
  tenancy_id: string
  type: 'entry' | 'exit'
  gas_reading: number | null
  electricity_reading: number | null
  photo_url: string | null
  submitted_by_user: string | null
  submitted_by_tenant: string | null
  submitted_at: string
}
