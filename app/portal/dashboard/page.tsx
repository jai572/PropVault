'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function TenantDashboardPage() {
  const [userId, setUserId] = useState<string | null | 'loading'>('loading')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Tenant portal — session check</h1>
      <p>
        <strong>User ID:</strong>{' '}
        {userId === 'loading' ? 'checking…' : userId ?? 'null — no session'}
      </p>
      <button onClick={handleSignOut} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
        Sign out
      </button>
    </div>
  )
}
