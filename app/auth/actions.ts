'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    redirect('/login?error=Invalid+email+or+password')
  }

  // Check role in public.users. Tenants have no row there — send them to
  // the tenant portal directly so the session cookie doesn't need to survive
  // a middleware-initiated double redirect.
  const { data: landlordRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', data.user.id)
    .maybeSingle()

  redirect(landlordRow ? '/dashboard' : '/portal/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(
  _prev: { sent: boolean },
  formData: FormData
): Promise<{ sent: boolean }> {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sent: true } // return same shape — don't reveal validation result
  }

  const supabase = await createClient()
  // Always returns { sent: true } regardless of outcome — do not reveal whether email exists
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prop-vault-rho.vercel.app'}/auth/reset-password`,
  })
  return { sent: true }
}
