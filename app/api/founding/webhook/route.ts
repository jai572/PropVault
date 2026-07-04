import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const email = (session.customer_email ?? session.customer_details?.email ?? '').toLowerCase()
    const name = (session.metadata?.name ?? '').trim()

    if (!email) {
      console.error('checkout.session.completed: no email on session', session.id)
      return NextResponse.json({ received: true })
    }

    // 1. Update founding_members record to active
    await supabase
      .from('founding_members')
      .update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('email', email)

    // 2. Create Supabase Auth account (idempotent — if account already exists this is a no-op)
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (createError && createError.message !== 'User already registered') {
      console.error('Auth createUser error for founding member:', email, createError.message)
      // Don't fail the webhook — Stripe has already confirmed payment. Log and move on.
      return NextResponse.json({ received: true })
    }

    // Use the newly created auth user id, or look up existing
    let authId: string | undefined = createData?.user?.id
    if (!authId) {
      const { data: listData } = await supabase.auth.admin.listUsers()
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email)
      authId = existing?.id
    }

    // 3. Upsert row in public.users with role = owner
    if (authId) {
      const { error: userInsertError } = await supabase
        .from('users')
        .upsert(
          {
            auth_id: authId,
            name: name || email,
            email,
            role: 'owner',
            status: 'active',
          },
          { onConflict: 'email' }
        )
      if (userInsertError) {
        console.error('users upsert error for founding member:', email, userInsertError.message)
      }
    }

    // 4. Send password-reset / magic link so they can set their own password
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prop-vault-rho.vercel.app'}/dashboard`,
      },
    })
    if (resetError) {
      console.error('generateLink error for founding member:', email, resetError.message)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await supabase
      .from('founding_members')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
