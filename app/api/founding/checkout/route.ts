import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' })
}

// Simple in-memory rate limiter: 5 requests per IP per hour.
// Not shared across Vercel serverless instances — sufficient for a low-traffic
// public beta. Replace with Redis/Upstash for multi-instance production use.
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_MAX = 5
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let body: { name?: unknown; email?: unknown; property_count?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  const propertyCount = typeof body.property_count === 'string' ? body.property_count.slice(0, 50) : ''

  if (!name || !email || !propertyCount) {
    return NextResponse.json({ error: 'Name, email and property count are required' }, { status: 400 })
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const origin = req.nextUrl.origin

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [
      {
        price: process.env.STRIPE_FOUNDING_PRICE_ID!,
        quantity: 1,
      },
    ],
    subscription_data: {
      // Trial until 1 October 2026 — calculated at request time on server
      trial_end: Math.floor(new Date('2026-10-01T00:00:00Z').getTime() / 1000),
      metadata: { founding_member: 'true' },
    },
    metadata: { name, property_count: propertyCount },
    success_url: origin + '/founding/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/founding?cancelled=1',
  })

  // Upsert founding member record
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('founding_members')
    .upsert(
      {
        name,
        email,
        property_count: propertyCount,
        stripe_session_id: session.id,
        status: 'checkout_started',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )

  if (error) {
    console.error('founding_members upsert error:', error.message)
    // Don't block — Stripe session already created, webhook will backfill
  }

  return NextResponse.json({ url: session.url })
}
