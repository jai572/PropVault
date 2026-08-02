# PropVault — Architecture & Developer Onboarding

> Last updated against branch `claude/wonderful-cerf-d2lbhg`. If migrations or policies have been applied directly in the Supabase dashboard after this date, this document may be out of sync. See §10 for known drift.

---

## 1. Project Overview

PropVault is a property management platform for private residential landlords in Scotland. It handles the operational lifecycle of a rental portfolio: tenancy creation (Private Residential Tenancy agreements), compliance certificate tracking, tenant communications, maintenance job management, and rent ledger. The platform generates legally-compliant PRT documents using `pdf-lib` and stores them in private Supabase Storage buckets.

There are two distinct user-facing surfaces: a landlord dashboard (authenticated via Supabase email/password, role-gated) and a tenant portal (same auth system, separate role, separate routes). The codebase was built for a single-operator portfolio and has been extended to support multiple landlord accounts under a shared super_admin umbrella.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.3 — App Router only, no Pages Router |
| Language | TypeScript 5.8, strict mode enabled |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL 15), RLS enabled on every table |
| Auth | Supabase Auth (email/password), session managed via `@supabase/ssr` 0.6 |
| Storage | Supabase Storage — private buckets, signed URL access only |
| Hosting | Vercel (auto-deploy from GitHub main; feature branches via preview URLs) |
| PDF generation | `pdf-lib` — pure JS, runs in a Next.js server action, no external service |
| Payments | Stripe (founding-member checkout only; not used for rent) |
| React | React 19 — `useActionState` used for all server action forms |

**Significant configuration decisions:**

- `typescript.strict: true` in `tsconfig.json`. Type errors block Vercel builds.
- `@supabase/ssr` is used throughout instead of `@supabase/auth-helpers-nextjs` (the older package). The two are not compatible — do not mix them.
- Tailwind v4 uses a CSS-first config (`@import "tailwindcss"` in `globals.css`). There is no `tailwind.config.js`.
- No ORM. All database access is through the Supabase JS client (PostgREST under the hood).

---

## 3. Actor Model

### super_admin

Platform operator. Has a row in the `users` table with `role = 'super_admin'` and no entries in `user_legal_entities`. Sees **no portfolio data** on `/dashboard` or `/tenants` by default — those pages explicitly filter by the user's linked entities, so an empty junction returns an empty page. The super_admin's access path to portfolio data is `/admin`, a search panel (email or entity name) that leverages the RLS bypass granted to this role.

### owner

A landlord who owns one or more legal entities. Has a row in `users` with `role = 'owner'` and one or more rows in `user_legal_entities` linking their user ID to each legal entity. The dashboard, tenants list, and property pages all filter data through `current_user_legal_entity_ids()` (see §5). An owner cannot see properties belonging to a different owner's legal entities.

### tenant

A tenant invited via a token link, who completes onboarding and ends up with a Supabase Auth account. Their `users`-equivalent is a row in the `tenants` table with `auth_id` set. They are routed to `/portal/dashboard` after login and cannot access any landlord route. Their data access is governed by the `tenants_self_read` and `tenancy_tenants_by_landlord` policies (which include a self-access branch).

### contractor / viewing_agent (future)

Not yet implemented with full auth. Currently, contractors and viewing agents exist as reference data only (`contractors` and `viewing_agents` tables). The intended model is unique-link access scoped to a single job, with no persistent auth account.

---

## 4. Authentication and Session Management

Supabase Auth issues JWTs stored as cookies. The `@supabase/ssr` package handles cookie reads and writes correctly in both server and client contexts.

### Three client variants

**`lib/supabase/client.ts`** — browser client, uses `createBrowserClient` from `@supabase/ssr`. Instantiated in client components (`'use client'`). Uses the anon key; RLS applies to every query.

**`lib/supabase/server.ts`** — server client, uses `createServerClient` from `@supabase/ssr`. Used in server components, server actions, and the middleware. Reads and writes cookies via the `next/headers` cookie store. Uses the anon key; RLS applies.

**`lib/supabase/service.ts`** — service role client, uses the raw `@supabase/supabase-js` `createClient`. Uses `SUPABASE_SERVICE_ROLE_KEY`. **Bypasses RLS entirely.** Used only in two places: `app/api/documents/view/route.ts` (to generate storage signed URLs) and `app/tenants/page.tsx` (to fetch document counts keyed by tenant — a pre-existing architectural decision that should be revisited). Never import this in a client component.

### Session propagation

After `signInWithPassword`, the session cookie is set by Supabase Auth. The `updateSession` call in `lib/supabase/middleware.ts` refreshes the token on every request. The login page (`app/login/page.tsx`) uses a client-side `router.push()` (not a server-side `redirect()`) after sign-in, because server-side redirect fires before the Set-Cookie response header reaches the browser, which caused a blank page on first load.

### Middleware

`middleware.ts` runs on every non-static request. It:
1. Calls `updateSession` to refresh the JWT if needed.
2. Redirects unauthenticated users to `/login`.
3. Redirects authenticated users away from `/login` to their correct home (`/dashboard` for landlords, `/portal/dashboard` for tenants).
4. Enforces role-based route guards: `LANDLORD_ONLY_PREFIXES`, `TENANT_ONLY_PREFIXES`, and `SUPER_ADMIN_ONLY_PREFIXES`.

The middleware fetches one row from `users` to determine the actor type. A row in `users` = landlord/admin; no row = tenant.

---

## 5. RLS Architecture

Every table has RLS enabled. The anon key client (used everywhere except the service client) is subject to all policies. This is the most complex part of the codebase.

### The SECURITY DEFINER pattern

PostgreSQL evaluates RLS policies as the calling user. When a policy subquery references another RLS-protected table, that table's policies are also evaluated — which can reference yet another table, creating a cycle (PostgreSQL error `42P17: infinite recursion detected in policy`).

The solution used throughout this codebase is `SECURITY DEFINER` functions. These run as the PostgreSQL superuser (`postgres` role), which has `BYPASSRLS`. Any table they query is read without policy evaluation. The function can still access `auth.uid()` (which reads from the JWT, not the PostgreSQL role) to identify the calling user.

**Rule:** whenever a policy needs to query a table that is itself RLS-protected, that query must go through a `SECURITY DEFINER` function, not a raw subquery.

### SECURITY DEFINER functions (as of migration 029)

| Function | Returns | Purpose | Used by |
|---|---|---|---|
| `current_user_role()` | `TEXT` | Reads `users.role` for the current JWT user | `legal_entities`, `users`, `properties`, `tenancies`, `documents`, `viewing_jobs`, `maintenance_jobs`, `communications`, `property_facilities`, `rent_records`, `tenants` policies |
| `current_user_legal_entity_id()` | `UUID` | Scalar wrapper around `current_user_legal_entity_ids()`, returns first match. Legacy — kept for compatibility | Indirectly via `current_user_legal_entity_ids()` |
| `current_user_legal_entity_ids()` | `SETOF UUID` | Returns all legal entity IDs linked to the current user via `user_legal_entities` junction | `properties`, `tenancies`, `documents`, `viewing_jobs`, `maintenance_jobs`, `communications`, `property_facilities`, `legal_entities` policies |
| `current_tenant_id()` | `UUID` | Reads `tenants.id` where `auth_id = auth.uid()` | `tenants_self_read`, `tenancy_tenants_by_landlord` (self branch), `documents_by_legal_entity` (self branch) |
| `current_landlord_tenancy_ids()` | `SETOF UUID` | Returns all tenancy IDs the current user is landlord for, by looking up `users.id` then `tenancies.landlord_id` | `tenancy_tenants_by_landlord`, `rent_records_by_landlord` |
| `current_owner_tenant_ids()` | `SETOF UUID` | Returns all tenant IDs reachable through the owner's properties: `tenancy_tenants → tenancies → properties → legal_entity_id` | `tenants_by_legal_entity` |
| `current_tenant_tenancy_ids()` | `SETOF UUID` | Returns the tenancy IDs the currently authenticated tenant is linked to, by reading `tenancy_tenants` as postgres (bypassing RLS). Allows tenants to read their own tenancy rows without a raw subquery that would re-enter the tenancy_tenants policy. | `tenancies_by_landlord` (tenant self-read branch) |
| `mark_overdue_rent_records()` | `void` | Updates `rent_records` rows where `due_date < CURRENT_DATE AND status IN ('pending','partial')` to `'overdue'`. Called on page load before fetching rent records. | Called via RPC in `app/properties/[id]/page.tsx` |

### The circular dependency history

Three separate RLS cycles were encountered and fixed:

**Cycle 1 (migration 021):** `tenants` policy queried `tenancy_tenants` → `tenancy_tenants` policy queried `tenants` → loop. Fixed by introducing `current_tenant_id()` SECURITY DEFINER, removing the raw `tenants` subquery from `tenancy_tenants`.

**Cycle 2 (migration 023):** `tenancy_tenants` policy queried `tenancies` (with RLS) → `tenancies` policy queried `tenancy_tenants` (with RLS) → loop. Fixed by introducing `current_landlord_tenancy_ids()` SECURITY DEFINER, which reads `tenancies` directly as postgres without triggering the tenancies policy.

**Cycle 3 (migration 029):** After migration 025 rebuilt the `tenants` policy using `current_owner_tenant_ids()`, the embedded PostgREST join `tenancy_tenants(tenants(...))` triggered the `tenants` policy, which called `current_owner_tenant_ids()`, which queries `tenancy_tenants`, re-entering the `tenancy_tenants` policy. Fixed by making `current_owner_tenant_ids()` SECURITY DEFINER, breaking the re-entry path.

---

## 6. Database Schema

All tables have RLS enabled.

| Table | Description |
|---|---|
| `legal_entities` | Property-owning entities (individuals or companies). Holds name, type, contact details, registration number. |
| `users` | Internal accounts (landlords, managers, super_admin). Linked to `auth.users` via `auth_id`. `legal_entity_id` column retained but superseded by `user_legal_entities` junction. |
| `user_legal_entities` | Junction table: maps one user to many legal entities. Added in migration 025 to replace the single `users.legal_entity_id` FK. |
| `properties` | Physical properties. Linked to a `legal_entity` via `legal_entity_id`. Holds address, type, HMO flag, compliance expiry dates, `has_gas`. |
| `property_facilities` | Per-property facility list (included / shared / excluded areas). Used to populate Section 5 of the PRT. |
| `tenants` | Tenant records. Created by landlords before a tenancy exists. `auth_id` is set once the tenant creates a Supabase Auth account via the invite link. |
| `tenancies` | A tenancy linking a property, a landlord, and one or more tenants. Holds rent amount, due day, deposit fields, status. |
| `tenancy_tenants` | Junction: which tenants are on which tenancy, with `is_lead_tenant` flag. |
| `documents` | File metadata for uploaded documents (PRT, right-to-rent, deposit certificates). Stores the storage path, not the signed URL. |
| `rent_records` | Auto-generated monthly rent entries per tenancy. Created by trigger on tenancy insert. Holds `amount_due`, `amount_paid`, `status`, `paid_date`, `notes`. |
| `contractors` | Reference data for maintenance contractors. |
| `viewing_agents` | Reference data for viewing agents. |
| `viewing_jobs` | Viewing appointments linked to a property. |
| `maintenance_jobs` | Maintenance tasks linked to a property and optionally a contractor and communication. |
| `communications` | Tenant → landlord or landlord → tenant messages, linked via tenancy. |
| `notices` | Formal notices (e.g. Notice to Leave). Not yet surfaced in the UI. |
| `reminders` | Compliance reminders auto-generated by trigger on property insert/update. |
| `meter_readings` | Utility meter readings per property. Not yet surfaced in the UI. |
| `landlord_survey_responses` | Standalone table for pre-launch survey responses. No FK to other tables. |
| `founding_members` | Signups from the `/founding` page. Linked to Stripe checkout sessions. |

**`user_legal_entities` — why it replaced the FK:**

The original `users.legal_entity_id` was a single FK allowing one user per legal entity. When the requirement arose to give one owner account access to four legal entities (J Bhalani, N Bhalani, TJ Property Consultants Ltd, Devarran-II Ltd), the FK model broke. Migration 025 added the junction table and migrated existing data. The old column is retained for compatibility but ignored by all RLS policies and application queries.

---

## 7. Migration History

Migrations must be run in order in the Supabase SQL editor. There is no automatic migration runner — Supabase's built-in migration tooling is not used.

| Migration | Description | Notes |
|---|---|---|
| `001` | Initial schema: all tables, initial RLS policies, `current_user_role()` and `current_user_legal_entity_id()` helper functions | Foundation; partially superseded by 020–029 |
| `002` | Seed: 4 real legal entities | Data-only |
| `003` | Seed: 12 portfolio properties | Data-only |
| `004` | Remove 47 Constitution St and 440 George St | Data-only |
| `005` | Fix duplicate legal_entities rows; add UNIQUE constraint on name | |
| `006` | Seed internal users (super_admin row for Jai Bhalani) | |
| `007` | Compliance reminder auto-generation trigger on `properties` | |
| `008` | Add `has_gas` column to `properties`; update trigger | Amends 007 |
| `009` | Private storage bucket for right-to-rent documents; storage RLS policies | |
| `010` | Add `created_by_user_id`, `legal_entity_id` to `tenants`; add `withdrawn` status | |
| `011` | Private storage bucket for PRT documents | |
| `012` | Add contact details columns to `legal_entities`; seed addresses | |
| `013` | `property_facilities` table + RLS; used for PRT Section 5 | |
| `014` | Add `link_expires_at` to `tenants` | |
| `015` | Add deposit resolution fields and `closure_reason` to `tenancies` | |
| `016_backfill_property_status` | Backfill `properties.status` based on active tenancies | Data-only |
| `016_landlord_survey` | `landlord_survey_responses` table | Duplicate `016` prefix — apply both |
| `017` | Add Section 6 adoption questions to survey table | |
| `018` | `founding_members` table; Stripe checkout integration | |
| `019` | Add `deposit_certificate_url` to `tenancies`; private storage bucket | |
| `020` | Extend RLS to allow tenants to read their own tenancy_tenants, tenancies, documents via portal | Introduced cycle 1 (fixed in 021) |
| `021` | Fix `tenants ↔ tenancy_tenants` RLS cycle; introduce `current_tenant_id()` SECURITY DEFINER | Fixes 020 |
| `022` | Split `tenants_self_read` into a separate SELECT policy | Patches 001/020 |
| `023` | Fix `tenancy_tenants ↔ tenancies` RLS cycle; introduce `current_landlord_tenancy_ids()` SECURITY DEFINER | Fixes 020 |
| `024` | `rent_records` schema patch (notes, default 0); auto-generation trigger; `mark_overdue_rent_records()`; backfill | |
| `025` | `user_legal_entities` junction table; `current_user_legal_entity_ids()` SECURITY DEFINER; rebuild all entity-scoped RLS policies | **Major policy rebuild — supersedes all `legal_entity_id = current_user_legal_entity_id()` checks in earlier migrations** |
| `026` | Insert owner `users` row (`jai.owner@propvault.internal`); link to 4 legal entities | `auth_id` must be set manually after creating the auth account |
| `027` | Add `legal_entities_own_read` SELECT policy so owners can read their own entities | Fixes omission in 025 |
| `028` | Fix `tenancies_by_landlord` policy: scope by `property_id → properties.legal_entity_id` instead of `landlord_id` | Fixes 025 |
| `029` | Fix `tenants` RLS cycle via `current_owner_tenant_ids()` SECURITY DEFINER | Fixes cycle introduced by 025 |
| `030` | Add `current_tenant_tenancy_ids()` SECURITY DEFINER; add tenant self-read branch to `tenancies_by_landlord` policy | Captures changes applied directly in SQL editor |

---

## 8. Key File Locations

| What | Where |
|---|---|
| Middleware (auth, route guards) | `middleware.ts` |
| Supabase browser client | `lib/supabase/client.ts` |
| Supabase server client (RLS) | `lib/supabase/server.ts` |
| Supabase service client (bypasses RLS) | `lib/supabase/service.ts` |
| Auth server actions (signIn, signOut, resetPassword) | `app/auth/actions.ts` |
| Landlord dashboard | `app/dashboard/page.tsx` |
| Property detail page | `app/properties/[id]/page.tsx` |
| End tenancy server action | `app/properties/[id]/end-tenancy-action.ts` |
| Rent ledger client component | `app/properties/[id]/RentLedger.tsx` |
| Rent ledger server action | `app/properties/[id]/rent-actions.ts` |
| Tenants list | `app/tenants/page.tsx` |
| Tenant detail | `app/tenants/[id]/page.tsx` |
| Create tenancy flow | `app/properties/[id]/create-tenancy/` |
| PRT PDF generator | `lib/prt/generate.ts` |
| Document signed URL API route | `app/api/documents/view/route.ts` |
| Tenant portal dashboard | `app/portal/dashboard/page.tsx` |
| Tenant portal data API | `app/api/portal/me/route.ts` |
| Admin panel (super_admin only) | `app/admin/page.tsx` |
| Founding members checkout | `app/api/founding/checkout/route.ts` |
| Stripe webhook handler | `app/api/founding/webhook/route.ts` |
| Landlord survey API | `app/api/survey/route.ts` |

---

## 9. Environment Variables

| Variable | Required | Used in | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client, server, middleware | Supabase project URL. Safe to expose — it is the PostgREST endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client, server, middleware | Supabase anon key. Safe to expose — RLS enforces data isolation. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `lib/supabase/service.ts` | Bypasses RLS. **Server-side only. Never expose to the browser.** Must be regenerated before going live if the current value has been committed or logged anywhere. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Auth redirect URLs | Base URL used for email confirmation and password reset links. Set to `https://propvault.co.uk` in production. |
| `NEXT_PUBLIC_APP_URL` | Yes | Tenant invite links | Same as `NEXT_PUBLIC_SITE_URL` in practice — used in tenant invitation email templates. Consolidation into one variable is pending. |
| `STRIPE_SECRET_KEY` | Yes (founding flow) | `app/api/founding/` | Stripe secret key. Server-side only. Not used for rent collection. |
| `STRIPE_FOUNDING_PRICE_ID` | Yes (founding flow) | `app/api/founding/checkout/route.ts` | Stripe Price ID for the founding-member product. |
| `STRIPE_WEBHOOK_SECRET` | Yes (founding flow) | `app/api/founding/webhook/route.ts` | Stripe webhook signing secret. **Flag for rotation** — if this was ever logged or committed, rotate it in the Stripe dashboard before going live. |

> **Security note:** No Resend or email-sending API key is present in the application code. Tenant invite emails are currently sent through Supabase Auth's built-in email provider (limited to 4 emails/hour on the free tier). If you add Resend later, add `RESEND_API_KEY` as a server-only variable and ensure it is never prefixed with `NEXT_PUBLIC_`.

---

## 10. Known Issues and Technical Debt

### Direct SQL changes not in migration files

The following policies were applied directly in the Supabase SQL editor during debugging and are **not reflected in any migration file**. The migration files on disk are therefore inconsistent with the live database for these objects:

- `tenancies_by_landlord` — rebuilt directly multiple times (migrations 028 and 030 capture the final state).
- `tenants_by_legal_entity` and `tenants_self_read` — rebuilt directly (migration 029 captures the final state).
- `legal_entities_own_read` — added directly (migration 027 captures this).
- `current_owner_tenant_ids()` — created directly (migration 029 captures this).
- `current_tenant_tenancy_ids()` — created directly (migration 030 captures this).

**Before onboarding a second developer or setting up a staging environment, the live policy state should be dumped and reconciled against the migration files.**

### Admin panel uses anon client

`app/admin/page.tsx` uses `createClient()` (anon key, RLS applies). The super_admin role bypass in each policy allows it to see all data. However, for the tenant search in the admin panel, the code does multiple sequential queries (property IDs → tenancy IDs → tenant IDs) rather than a single join, partly because the RLS on `tenants` only allows access via `current_owner_tenant_ids()` (which returns nothing for super_admin, since super_admin has no entity links). The admin panel's tenant search currently **may return zero tenants** even when tenancies exist. A service role client or a separate super_admin SECURITY DEFINER function for cross-portfolio tenant lookup would fix this properly.

### Tenants field still blank on property page for some tenancies

The tenant names field on `app/properties/[id]/page.tsx` depends on the `tenants_by_legal_entity` policy returning rows for the owner account. If migration 029 has not been applied, or if there is residual recursion in the live policy, this field will be blank. The `activeTTError` is logged to the server console — check Vercel function logs for `[property page] tenancy_tenants fetch error`.

### `users.legal_entity_id` column is stale

The `users` table retains a `legal_entity_id` column that is no longer used by any RLS policy or application query. It should be dropped in a future migration once confirmed safe. The live super_admin row has `legal_entity_id = NULL`.

### Two migrations share the `016` prefix

`016_backfill_property_status.sql` and `016_landlord_survey.sql` both use the `016` prefix. Both must be applied; the ordering between them does not matter as they are independent.

### `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` are duplicated

Both variables resolve to the same base URL in production. One should be removed; the tenant invite code and auth redirect code should be unified to use a single variable.

---

## 11. Deployment

**Platform:** Vercel, connected to the `jai572/PropVault` GitHub repository.

**Deploy triggers:**
- Push to `main` → production deployment at the configured domain.
- Push to any other branch → preview deployment at a generated Vercel URL.
- The active development branch is `claude/wonderful-cerf-d2lbhg`. Merge to `main` to promote changes to production.

**Build process:** `next build`. TypeScript errors fail the build — check the Vercel build log for type errors before concluding a deployment is broken for another reason.

**Environment variables:** Managed in the Vercel project settings under Settings → Environment Variables. Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle at build time and cannot be changed without a redeploy. Server-only variables (no `NEXT_PUBLIC_` prefix) are injected at runtime.

**Database migrations:** There is no automated migration runner. Migrations must be applied manually in the Supabase SQL editor before or after deploying the code that depends on them, depending on whether the change is backwards-compatible. The Supabase project is shared across all environments (no separate staging database is currently configured).

**Supabase Auth email provider:** Uses Supabase's built-in SMTP on the free tier (rate-limited to 4 emails/hour). For production use, configure a custom SMTP provider (e.g. Resend) in the Supabase Auth settings — no code changes are required, only configuration.
