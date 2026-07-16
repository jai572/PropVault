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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatGBP(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      {label}
    </a>
  )
}

function Skeleton() {
  return <div className="h-5 w-40 rounded bg-gray-100 animate-pulse" />
}

export default function TenantDashboardPage() {
  const [sessionChecked, setSessionChecked] = useState(false)
  const [data, setData] = useState<PortalData | null | typeof LOADING>(LOADING)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSessionChecked(true)
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

  const profile = data !== LOADING ? data?.profile ?? null : null
  const tenancy = data !== LOADING ? data?.tenancy ?? null : null
  const prt     = data !== LOADING ? data?.prt ?? null : null
  const fetching = !sessionChecked || data === LOADING

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portal header — isolated, no landlord navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-900">PropVault</span>
              <span className="text-sm text-gray-400 font-medium">Tenant portal</span>
            </div>
            <div className="flex items-center gap-4">
              {profile && (
                <span className="hidden sm:block text-sm text-gray-600">
                  {profile.first_name} {profile.last_name}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4">
        {/* Tenancy reference banner */}
        {(fetching || tenancy) && (
          <div className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-3">
            <span className="text-sm text-gray-500">Tenancy reference</span>
            {fetching ? <Skeleton /> : (
              <span className="text-sm font-semibold text-gray-900 font-mono">
                {tenancy!.tenancy_reference}
              </span>
            )}
          </div>
        )}

        {/* Section 1 — Tenancy agreement */}
        <SectionCard title="Tenancy agreement">
          {fetching ? (
            <Skeleton />
          ) : prt ? (
            <DocLink
              href={`/api/documents/view?path=${encodeURIComponent(prt.file_url)}&bucket=prt-documents`}
              label="View / download Private Residential Tenancy"
            />
          ) : (
            <p className="text-sm text-gray-500">Not yet available.</p>
          )}
        </SectionCard>

        {/* Section 2 — Deposit certificate */}
        <SectionCard title="Deposit certificate">
          {fetching ? (
            <Skeleton />
          ) : tenancy?.deposit_certificate_url ? (
            <DocLink
              href={`/api/documents/view?path=${encodeURIComponent(tenancy.deposit_certificate_url)}&bucket=deposit-certificates`}
              label="View / download deposit certificate"
            />
          ) : (
            <p className="text-sm text-gray-500">Deposit certificate not yet available.</p>
          )}
        </SectionCard>

        {/* Section 3 — Payment schedule */}
        <SectionCard title="Payment schedule">
          {fetching ? (
            <div className="space-y-3">
              <Skeleton /><Skeleton /><Skeleton />
            </div>
          ) : tenancy ? (
            <dl className="divide-y divide-gray-100">
              {([
                ['Start date',    formatDate(tenancy.start_date)],
                ['Monthly rent',  formatGBP(tenancy.rent_amount)],
                ['Rent due',      `${ordinal(tenancy.rent_due_day)} of each month`],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-semibold text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No active tenancy found for your account.</p>
          )}
        </SectionCard>
      </main>
    </div>
  )
}
