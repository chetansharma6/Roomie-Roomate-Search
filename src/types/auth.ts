import type { Session, User } from '@supabase/supabase-js'

export type AuthDestination = '/onboarding' | '/discover'
export interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  error: string | null
  destination: AuthDestination | null
}
