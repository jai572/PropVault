'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { TenantProfile } from './actions'

export default function TenantDashboardPage() {
  const [userId, setUserId] = useState<string | null | 'loading'>('loading')
  const [profile, setProfile] = useState<TenantProfile | null | 'loading'>('loading')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (user) {
        fetch('/api/portal/me')
          .then(r => r.json())
          .then(({ profile }) => setProfile(profile ?? null))
          .catch(() => setProfile(null))
      } else {
        setProfile(null)
      }
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (userId === 'loading') {
    return (
      <div style={{ fontFamily: 'monospace', padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ display: 'inline-block', width: '1rem', height: '1rem', border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span>Loading session…</span>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Tenant portal — session check</h1>

      <p><strong>User ID:</strong> {userId ?? 'null — no session'}</p>

      <hr style={{ margin: '1rem 0' }} />

      <h2>Tenant profile</h2>
      {profile === 'loading' ? (
        <p>Fetching profile…</p>
      ) : profile === null ? (
        <p>No tenant record found for this account.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {([ ['First name', profile.first_name], ['Last name', profile.last_name], ['Email', profile.email], ['Status', profile.status] ] as [string, string][]).map(([label, value]) => (
              <tr key={label}>
                <td style={{ paddingRight: '1.5rem', fontWeight: 'bold' }}>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={handleSignOut} style={{ marginTop: '1.5rem', padding: '0.5rem 1rem' }}>
        Sign out
      </button>
    </div>
  )
}
