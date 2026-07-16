'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { TenantProfile } from './actions'

type Tenancy = {
  id: string
  tenancy_reference: string
  start_date: string
  rent_amount: number
  rent_due_day: number
  deposit_amount: number | null
  deposit_scheme: string | null
  deposit_certificate_url: string | null
  status: string
}

type PortalData = {
  profile: TenantProfile | null
  tenancy: Tenancy | null
  prt: { id: string; file_url: string } | null
}

const LOADING = 'loading' as const

export default function TenantDashboardPage() {
  const [userId, setUserId] = useState<string | null | typeof LOADING>(LOADING)
  const [data, setData] = useState<PortalData | null | typeof LOADING>(LOADING)

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
          .then((json) => setData(json.error ? null : json))
          .catch(() => setData(null))
      } else {
        setData(null)
      }
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (userId === LOADING) {
    return (
      <div style={{ fontFamily: 'monospace', padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ display: 'inline-block', width: '1rem', height: '1rem', border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span>Loading session…</span>
      </div>
    )
  }

  const profile = data !== LOADING ? data?.profile ?? null : null
  const tenancy = data !== LOADING ? data?.tenancy ?? null : null
  const prt     = data !== LOADING ? data?.prt ?? null : null
  const fetching = data === LOADING

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)

  const ordinal = (n: number) => {
    const s = ['th','st','nd','rd'], v = n % 100
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '640px' }}>
      <h1>Tenant portal</h1>

      <p style={{ marginBottom: '1.5rem' }}>
        <strong>User ID:</strong> {userId ?? 'null — no session'}
      </p>

      {/* Profile */}
      {fetching ? <p>Loading profile…</p> : profile ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Profile</h2>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {([
                ['Name', `${profile.first_name} ${profile.last_name}`],
                ['Email', profile.email],
                ['Status', profile.status],
              ] as [string, string][]).map(([label, value]) => (
                <tr key={label}>
                  <td style={{ paddingRight: '1.5rem', fontWeight: 'bold' }}>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : <p>No tenant record found.</p>}

      <hr style={{ margin: '1.5rem 0' }} />

      {/* Section 1 — Tenancy agreement (PRT) */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>1. Tenancy agreement</h2>
        {fetching ? (
          <p>Loading…</p>
        ) : prt ? (
          <a href={`/api/documents/view?url=${encodeURIComponent(prt.file_url)}`} target="_blank" rel="noopener noreferrer">
            View / download PRT →
          </a>
        ) : (
          <p>Not yet available.</p>
        )}
      </section>

      <hr style={{ margin: '1.5rem 0' }} />

      {/* Section 2 — Deposit certificate */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>2. Deposit certificate</h2>
        {fetching ? (
          <p>Loading…</p>
        ) : tenancy?.deposit_certificate_url ? (
          <a href={`/api/documents/view?url=${encodeURIComponent(tenancy.deposit_certificate_url)}`} target="_blank" rel="noopener noreferrer">
            View / download deposit certificate →
          </a>
        ) : (
          <p>Deposit certificate not yet available.</p>
        )}
      </section>

      <hr style={{ margin: '1.5rem 0' }} />

      {/* Section 3 — Payment schedule */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>3. Payment schedule</h2>
        {fetching ? (
          <p>Loading…</p>
        ) : tenancy ? (
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {([
                ['Start date', formatDate(tenancy.start_date)],
                ['Monthly rent', formatAmount(tenancy.rent_amount)],
                ['Rent due', `${ordinal(tenancy.rent_due_day)} of each month`],
              ] as [string, string][]).map(([label, value]) => (
                <tr key={label}>
                  <td style={{ paddingRight: '1.5rem', fontWeight: 'bold' }}>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No active tenancy found for your account.</p>
        )}
      </section>

      <button onClick={handleSignOut} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}>
        Sign out
      </button>
    </div>
  )
}
