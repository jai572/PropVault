import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > windowStart)
  if (timestamps.length >= RATE_LIMIT_MAX) return false
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

const BOOLEAN_COLS = new Set([
  'tool_spreadsheet', 'tool_accounting', 'tool_landlord_software',
  'tool_compliance', 'tool_other', 'tool_none', 'marketing_consent',
  'task_marketing_handled', 'task_viewings_handled', 'task_referencing_handled',
  'task_tenancy_agreement_handled', 'task_inventory_handled', 'task_deposit_handled',
  'task_rent_collection_handled', 'task_rent_statements_handled', 'task_late_rent_handled',
  'task_maintenance_handled', 'task_inspections_handled', 'task_compliance_handled',
  'task_notices_handled', 'task_disputes_handled', 'task_council_tax_handled',
  'task_remarketing_handled',
  'comfort_marketing', 'comfort_viewings', 'comfort_referencing',
  'comfort_tenancy_agreement', 'comfort_inventory', 'comfort_deposit',
  'comfort_rent_collection', 'comfort_rent_statements', 'comfort_late_rent',
  'comfort_maintenance', 'comfort_inspections', 'comfort_compliance',
  'comfort_notices', 'comfort_disputes', 'comfort_council_tax', 'comfort_remarketing',
])

const TEXT_COLS = new Set([
  'property_count', 'agent_use', 'fee_management_band', 'fee_tenantfind_amount',
  'fee_renewal_amount', 'fee_other_amount', 'fee_exit_amount', 'vat_basis',
  'fee_total_monthly', 'tool_cost', 'agent_tenure',
  'task_marketing_followup', 'task_viewings_followup', 'task_referencing_followup',
  'task_tenancy_agreement_followup', 'task_inventory_followup', 'task_deposit_followup',
  'task_rent_collection_followup', 'task_rent_statements_followup', 'task_late_rent_followup',
  'task_maintenance_followup', 'task_inspections_followup', 'task_compliance_followup',
  'task_notices_followup', 'task_disputes_followup', 'task_council_tax_followup',
  'task_remarketing_followup',
  'tried_self', 'went_back_reason', 'still_self_reason', 'never_tried_reason',
  'agent_irreplaceable', 'exit_fee_experience',
  'price_expectation', 'interest_scale', 'location', 'email',
  'adoption_most_annoying', 'adoption_admin_hours', 'adoption_portal_interest',
  'adoption_top_priority', 'adoption_switching_barrier',
])

const REQUIRED_TEXT_COLS = new Set(['email'])

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (BOOLEAN_COLS.has(key)) {
      row[key] = value === true
    } else if (TEXT_COLS.has(key)) {
      const str = typeof value === 'string' ? value.trim().slice(0, 2000) : null
      if (REQUIRED_TEXT_COLS.has(key) && (!str || str.length < 1)) {
        return NextResponse.json({ error: `${key} is required` }, { status: 400 })
      }
      row[key] = str
    }
    // Unknown keys are silently dropped
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('landlord_survey_responses').insert([row])
  if (error) {
    console.error('Survey insert error:', error.message)
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
