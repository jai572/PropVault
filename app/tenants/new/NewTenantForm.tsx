'use client'

import { useActionState } from 'react'
import { createProspectiveTenant, type CreateTenantState } from './actions'
import Link from 'next/link'
import type { LegalEntity } from '@/types'

const TOKEN_EXPIRY_HOURS = 72

function ApplicationLinkPanel({ token }: { token: string }) {
  const url = `${window.location.origin}/portal/apply/${token}`
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
    .toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-green-800">Prospective tenant created</p>
      </div>
      <p className="text-sm text-green-700">
        Share the link below. It expires at <strong>{expiry}</strong> (72 hours).
      </p>
      <div className="rounded-lg bg-white border border-green-200 px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm text-gray-700 font-mono break-all">{url}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          className="flex-shrink-0 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Copy
        </button>
      </div>
      <Link
        href="/tenants"
        className="inline-block text-sm text-green-700 underline hover:text-green-900"
      >
        View all tenants →
      </Link>
    </div>
  )
}

interface NewTenantFormProps {
  isSuperAdmin: boolean
  ownLegalEntityId: string | null
  legalEntities: Pick<LegalEntity, 'id' | 'name'>[]
}

const initialState: CreateTenantState = {}

export default function NewTenantForm({ isSuperAdmin, ownLegalEntityId, legalEntities }: NewTenantFormProps) {
  const [state, action, pending] = useActionState(createProspectiveTenant, initialState)

  if (state.token) {
    return (
      <div className="max-w-lg space-y-6">
        <Link href="/tenants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <span aria-hidden="true">←</span> All tenants
        </Link>
        <ApplicationLinkPanel token={state.token} />
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/tenants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <span aria-hidden="true">←</span> All tenants
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Add prospective tenant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Creates a unique 72-hour link for the tenant to upload their Right to Rent documents.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {state.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-5">
          {/* Legal entity — super_admin selects; owner/manager value is hidden */}
          {isSuperAdmin ? (
            <div>
              <label htmlFor="legal_entity_id" className="block text-sm font-medium text-gray-700 mb-1.5">
                Legal entity <span className="text-red-500">*</span>
              </label>
              <select
                id="legal_entity_id"
                name="legal_entity_id"
                required
                defaultValue=""
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
              >
                <option value="" disabled>Select entity…</option>
                {legalEntities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="legal_entity_id" value={ownLegalEntityId ?? ''} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            {pending ? 'Creating…' : 'Create tenant and generate link'}
          </button>
        </form>
      </div>
    </div>
  )
}
