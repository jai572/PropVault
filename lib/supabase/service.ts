import { createClient } from '@supabase/supabase-js'

// SECURITY: this client bypasses RLS. Use only in server-side code
// (server actions, route handlers). Never import in client components.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
