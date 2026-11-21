import { createClient } from '@supabase/supabase-js'
import { fetchWithOtpRetry } from './otpRetry'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.',
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: fetchWithOtpRetry },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
