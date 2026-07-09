/**
 * PropVault — Security Test Account Seed Script
 * Creates two fully isolated synthetic landlord accounts for security review.
 * No real personal data.
 */

import { createClient } from '@supabase/supabase-js'

import crypto from 'crypto'

const SUPABASE_URL = 'https://tkntmpaxqflmxmdlpvno.supabase.co'
const SERVICE_KEY  = 'sb_secret_UHsWOMKHMRR9AqdFeVMc5A_Fyx25rNv'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Passwords ────────────────────────────────────────────────────────────────
const PW_A = 'Pv#Test-' + crypto.randomBytes(6).toString('base64url') + '!9'
const PW_B = 'Pv#Test-' + crypto.randomBytes(6).toString('base64url') + '!7'

function log(msg) { console.log('\n' + msg) }
function die(label, err) { console.error('FATAL — ' + label, err); process.exit(1) }

// ── Minimal placeholder PNG (1×1 white pixel, labelled with tenant name) ────
function placeholderPng(label) {
  // 100×40 white canvas with black text — no canvas dep needed, just a raw 1×1 PNG
  // We'll use a hardcoded minimal valid PNG (1×1 white pixel)
  const PNG_1x1 = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e000000000c4944415478016360f8ffff3f0005fe02fedccc59e70000000049454e44ae426082',
    'hex'
  )
  return PNG_1x1
}

// ── Helper: insert and return single row ─────────────────────────────────────
async function insert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) die(`insert ${table}`, error)
  return data
}

async function main() {
  log('═══════════════════════════════════════════════════')
  log('PropVault Security Test Account Seed')
  log('═══════════════════════════════════════════════════')

  const ids = { A: {}, B: {} }

  // ════════════════════════════════════════════════════
  // ACCOUNT A — Caledonian Test Properties Ltd (company)
  // ════════════════════════════════════════════════════
  log('── Account A: Caledonian Test Properties Ltd ──────')

  // 1. Auth user
  const { data: authA, error: authErrA } = await supabase.auth.admin.createUser({
    email: 'testlandlord.a@propvault-test.com',
    password: PW_A,
    email_confirm: true,
  })
  if (authErrA) die('Auth A', authErrA)
  ids.A.authId = authA.user.id
  log(`Auth user A created: ${ids.A.authId}`)

  // 2. Legal entity
  const leA = await insert('legal_entities', {
    name: 'Caledonian Test Properties Ltd',
    type: 'company',
    landlord_registration_number: 'SCT-TEST-001',
    council_area: 'Aberdeen City',
  })
  ids.A.legalEntityId = leA.id
  log(`Legal entity A: ${leA.id}`)

  // 3. User row
  const userA = await insert('users', {
    auth_id: ids.A.authId,
    legal_entity_id: leA.id,
    name: 'Test Admin A',
    email: 'testlandlord.a@propvault-test.com',
    role: 'owner',
    status: 'active',
  })
  ids.A.userId = userA.id
  log(`User row A: ${userA.id}`)

  // 4. Properties
  const propsA = [
    {
      legal_entity_id: leA.id,
      address_line_1: '14 Rubislaw Den North',
      address_line_2: null,
      city: 'Aberdeen',
      postcode: 'AB15 4AL',
      property_type: 'Flat',
      bedrooms: 2,
      is_hmo: false,
      has_gas: true,
      status: 'occupied',
      epc_expiry: '2028-03-01',
      gas_safety_expiry: '2025-11-15',
      eicr_expiry: '2029-06-01',
    },
    {
      legal_entity_id: leA.id,
      address_line_1: '7 Holburn Street',
      address_line_2: 'Ground Floor Left',
      city: 'Aberdeen',
      postcode: 'AB10 6BU',
      property_type: 'Flat',
      bedrooms: 3,
      is_hmo: true,
      hmo_licence_number: 'HMO-TEST-2024-001',
      hmo_licence_expiry: '2026-09-30',
      has_gas: true,
      status: 'occupied',
      epc_expiry: '2027-05-01',
      gas_safety_expiry: '2025-12-01',
      eicr_expiry: '2028-11-01',
    },
    {
      legal_entity_id: leA.id,
      address_line_1: '32 Whitehall Road',
      address_line_2: null,
      city: 'Aberdeen',
      postcode: 'AB25 2PG',
      property_type: 'Terraced House',
      bedrooms: 3,
      is_hmo: false,
      has_gas: false,
      status: 'available',
      epc_expiry: '2027-08-01',
      gas_safety_expiry: null,
      eicr_expiry: '2028-04-01',
    },
  ]

  const createdPropsA = []
  for (const p of propsA) {
    const prop = await insert('properties', p)
    createdPropsA.push(prop)
    log(`  Property A[${createdPropsA.length}]: ${prop.id}  (${prop.address_line_1})`)
  }
  ids.A.propertyIds = createdPropsA.map(p => p.id)

  // 5. Synthetic tenants for Account A
  const tenantsA = [
    { first_name: 'Duncan', last_name: 'Mackintosh', email: 'test.tenant.dmack@propvault-test.com' },
    { first_name: 'Fiona', last_name: 'Calder', email: 'test.tenant.fcalder@propvault-test.com' },
    { first_name: 'Alistair', last_name: 'Forbes', email: 'test.tenant.aforbes@propvault-test.com' },
  ]

  const createdTenantsA = []
  for (const t of tenantsA) {
    const tenant = await insert('tenants', {
      ...t,
      status: 'active',
      right_to_rent_verified: true,
      right_to_rent_checked_date: '2025-01-15',
      right_to_rent_document_type: 'British Passport',
    })
    createdTenantsA.push(tenant)

    // Create auth account for tenant portal access
    const { data: tAuth } = await supabase.auth.admin.createUser({
      email: t.email,
      password: 'TestTenant#2025!',
      email_confirm: true,
    })
    if (tAuth?.user) {
      await supabase.from('tenants').update({ auth_id: tAuth.user.id }).eq('id', tenant.id)
    }

    // Upload placeholder RTR document
    const pngBuf = placeholderPng(`${t.first_name} ${t.last_name}`)
    const rtrPath = `${tenant.id}/test-passport-placeholder.png`
    await supabase.storage.from('right-to-rent-documents').upload(rtrPath, pngBuf, {
      contentType: 'image/png', upsert: true,
    })

    // Document row
    await insert('documents', {
      type: 'right_to_rent',
      file_url: rtrPath,
      uploaded_by: userA.id,
      delivered_to_tenant: false,
    })

    log(`  Tenant A[${createdTenantsA.length}]: ${tenant.id}  (${t.first_name} ${t.last_name})`)
  }
  ids.A.tenantIds = createdTenantsA.map(t => t.id)

  // 6. Tenancies for Account A (2 active)
  const tenanciesA = [
    {
      property_id: createdPropsA[0].id,  // Rubislaw Den
      landlord_id: userA.id,
      status: 'active',
      start_date: '2024-09-01',
      rent_amount: 975.00,
      rent_due_day: 1,
      deposit_amount: 975.00,
      deposit_scheme: 'mydeposits Scotland',
      deposit_reference: 'TEST-DEP-A-001',
      jurisdiction: 'scotland',
      tenancy_reference: '',
    },
    {
      property_id: createdPropsA[1].id,  // Holburn Street HMO
      landlord_id: userA.id,
      status: 'active',
      start_date: '2024-11-01',
      rent_amount: 650.00,
      rent_due_day: 1,
      deposit_amount: 650.00,
      deposit_scheme: 'mydeposits Scotland',
      deposit_reference: 'TEST-DEP-A-002',
      room_reference: 'Room 1',
      jurisdiction: 'scotland',
      tenancy_reference: '',
    },
  ]

  const createdTenanciesA = []
  for (let i = 0; i < tenanciesA.length; i++) {
    const ten = await insert('tenancies', tenanciesA[i])
    createdTenanciesA.push(ten)
    // Link lead tenant
    await insert('tenancy_tenants', {
      tenancy_id: ten.id,
      tenant_id: createdTenantsA[i].id,
      is_lead_tenant: true,
    })
    log(`  Tenancy A[${createdTenanciesA.length}]: ${ten.id}  (${ten.tenancy_reference})`)
  }
  ids.A.tenancyIds = createdTenanciesA.map(t => t.id)
  ids.A.tenancyRefs = createdTenanciesA.map(t => t.tenancy_reference)


  // ════════════════════════════════════════════════════
  // ACCOUNT B — Northern Test Estates (individual)
  // ════════════════════════════════════════════════════
  log('\n── Account B: Northern Test Estates ───────────────')

  // 1. Auth user
  const { data: authB, error: authErrB } = await supabase.auth.admin.createUser({
    email: 'testlandlord.b@propvault-test.com',
    password: PW_B,
    email_confirm: true,
  })
  if (authErrB) die('Auth B', authErrB)
  ids.B.authId = authB.user.id
  log(`Auth user B created: ${ids.B.authId}`)

  // 2. Legal entity
  const leB = await insert('legal_entities', {
    name: 'Northern Test Estates',
    type: 'individual',
    landlord_registration_number: 'SCT-TEST-002',
    council_area: 'City of Edinburgh',
  })
  ids.B.legalEntityId = leB.id
  log(`Legal entity B: ${leB.id}`)

  // 3. User row
  const userB = await insert('users', {
    auth_id: ids.B.authId,
    legal_entity_id: leB.id,
    name: 'Test Admin B',
    email: 'testlandlord.b@propvault-test.com',
    role: 'owner',
    status: 'active',
  })
  ids.B.userId = userB.id
  log(`User row B: ${userB.id}`)

  // 4. Properties
  const propsB = [
    {
      legal_entity_id: leB.id,
      address_line_1: '41 Morningside Road',
      address_line_2: 'Flat 3F2',
      city: 'Edinburgh',
      postcode: 'EH10 4BQ',
      property_type: 'Flat',
      bedrooms: 1,
      is_hmo: false,
      has_gas: true,
      status: 'occupied',
      epc_expiry: '2028-01-01',
      gas_safety_expiry: '2025-10-01',
      eicr_expiry: '2029-01-01',
    },
    {
      legal_entity_id: leB.id,
      address_line_1: '8 Bruntsfield Place',
      address_line_2: null,
      city: 'Edinburgh',
      postcode: 'EH10 4HN',
      property_type: 'Flat',
      bedrooms: 2,
      is_hmo: false,
      has_gas: true,
      status: 'available',
      epc_expiry: '2027-07-01',
      gas_safety_expiry: '2025-09-01',
      eicr_expiry: '2028-07-01',
    },
  ]

  const createdPropsB = []
  for (const p of propsB) {
    const prop = await insert('properties', p)
    createdPropsB.push(prop)
    log(`  Property B[${createdPropsB.length}]: ${prop.id}  (${prop.address_line_1})`)
  }
  ids.B.propertyIds = createdPropsB.map(p => p.id)

  // 5. Synthetic tenant for Account B
  const tenantsB = [
    { first_name: 'Morag', last_name: 'Sutherland', email: 'test.tenant.msuth@propvault-test.com' },
  ]

  const createdTenantsB = []
  for (const t of tenantsB) {
    const tenant = await insert('tenants', {
      ...t,
      status: 'active',
      right_to_rent_verified: true,
      right_to_rent_checked_date: '2025-02-10',
      right_to_rent_document_type: 'British Passport',
    })
    createdTenantsB.push(tenant)

    const { data: tAuth } = await supabase.auth.admin.createUser({
      email: t.email,
      password: 'TestTenant#2025!',
      email_confirm: true,
    })
    if (tAuth?.user) {
      await supabase.from('tenants').update({ auth_id: tAuth.user.id }).eq('id', tenant.id)
    }

    const pngBuf = placeholderPng(`${t.first_name} ${t.last_name}`)
    const rtrPath = `${tenant.id}/test-passport-placeholder.png`
    await supabase.storage.from('right-to-rent-documents').upload(rtrPath, pngBuf, {
      contentType: 'image/png', upsert: true,
    })

    await insert('documents', {
      type: 'right_to_rent',
      file_url: rtrPath,
      uploaded_by: userB.id,
      delivered_to_tenant: false,
    })

    log(`  Tenant B[${createdTenantsB.length}]: ${tenant.id}  (${t.first_name} ${t.last_name})`)
  }
  ids.B.tenantIds = createdTenantsB.map(t => t.id)

  // 6. Tenancy for Account B (1 active)
  const tenB = await insert('tenancies', {
    property_id: createdPropsB[0].id,
    landlord_id: userB.id,
    status: 'active',
    start_date: '2025-03-01',
    rent_amount: 1150.00,
    rent_due_day: 1,
    deposit_amount: 1150.00,
    deposit_scheme: 'mydeposits Scotland',
    deposit_reference: 'TEST-DEP-B-001',
    jurisdiction: 'scotland',
    tenancy_reference: '',
  })
  await insert('tenancy_tenants', {
    tenancy_id: tenB.id,
    tenant_id: createdTenantsB[0].id,
    is_lead_tenant: true,
  })
  ids.B.tenancyIds = [tenB.id]
  ids.B.tenancyRefs = [tenB.tenancy_reference]
  log(`  Tenancy B[1]: ${tenB.id}  (${tenB.tenancy_reference})`)


  // ════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ════════════════════════════════════════════════════
  log('\n\n' + '═'.repeat(60))
  log('SECURITY TEST ACCOUNT SUMMARY')
  log('═'.repeat(60))

  log(`
╔═══════════════════════════════════════════════════════╗
║  ACCOUNT A — Caledonian Test Properties Ltd (company) ║
╠═══════════════════════════════════════════════════════╣
║  Login email:   testlandlord.a@propvault-test.com     ║
║  Password:      ${PW_A.padEnd(37)}║
╠═══════════════════════════════════════════════════════╣
║  Auth ID (Supabase):  ${ids.A.authId.slice(0,36)}  ║
║  User row ID:         ${ids.A.userId.slice(0,36)}  ║
║  Legal entity ID:     ${ids.A.legalEntityId.slice(0,36)}  ║
╠═══════════════════════════════════════════════════════╣
║  Properties (3):                                      ║
║    [1] 14 Rubislaw Den North AB15 4AL (non-HMO)       ║
║        ${ids.A.propertyIds[0]}  ║
║    [2] 7 Holburn Street AB10 6BU (HMO)                ║
║        ${ids.A.propertyIds[1]}  ║
║    [3] 32 Whitehall Road AB25 2PG (non-HMO)           ║
║        ${ids.A.propertyIds[2]}  ║
╠═══════════════════════════════════════════════════════╣
║  Tenants (3):                                         ║
║    Duncan Mackintosh   ${ids.A.tenantIds[0]}  ║
║    Fiona Calder        ${ids.A.tenantIds[1]}  ║
║    Alistair Forbes     ${ids.A.tenantIds[2]}  ║
╠═══════════════════════════════════════════════════════╣
║  Tenancies (2 active):                                ║
║    ${ids.A.tenancyRefs[0].padEnd(12)} ${ids.A.tenancyIds[0]}  ║
║    ${ids.A.tenancyRefs[1].padEnd(12)} ${ids.A.tenancyIds[1]}  ║
╚═══════════════════════════════════════════════════════╝
`)

  log(`
╔═══════════════════════════════════════════════════════╗
║  ACCOUNT B — Northern Test Estates (individual)       ║
╠═══════════════════════════════════════════════════════╣
║  Login email:   testlandlord.b@propvault-test.com     ║
║  Password:      ${PW_B.padEnd(37)}║
╠═══════════════════════════════════════════════════════╣
║  Auth ID (Supabase):  ${ids.B.authId.slice(0,36)}  ║
║  User row ID:         ${ids.B.userId.slice(0,36)}  ║
║  Legal entity ID:     ${ids.B.legalEntityId.slice(0,36)}  ║
╠═══════════════════════════════════════════════════════╣
║  Properties (2):                                      ║
║    [1] 41 Morningside Road EH10 4BQ (non-HMO)        ║
║        ${ids.B.propertyIds[0]}  ║
║    [2] 8 Bruntsfield Place EH10 4HN (non-HMO)        ║
║        ${ids.B.propertyIds[1]}  ║
╠═══════════════════════════════════════════════════════╣
║  Tenant (1):                                          ║
║    Morag Sutherland    ${ids.B.tenantIds[0]}  ║
╠═══════════════════════════════════════════════════════╣
║  Tenancy (1 active):                                  ║
║    ${ids.B.tenancyRefs[0].padEnd(12)} ${ids.B.tenancyIds[0]}  ║
╚═══════════════════════════════════════════════════════╝
`)

  log('NOTE: Passwords shown above will not be displayed again.')
  log('NOTE: Tenant portal accounts all use password: TestTenant#2025!')
  log('NOTE: No real personal data — all addresses, names, and documents are synthetic.')
  log('\nSeed complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
