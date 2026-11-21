import { useEffect, useState } from 'react'
import { getMyProfile } from '../lib/profiles'
import { DataAccessError } from '../lib/dataAccess'
import type { ProfileRow } from '../types/database'

/** Mount after useAuth() restores a signed-in user. Key the consumer by user.id
 * so another user's previously loaded profile is never displayed.
 */
export function useMyProfileExample() {
  const [state, setState] = useState<{
    loading: boolean
    profile: ProfileRow | null
    error: string | null
  }>({ loading: true, profile: null, error: null })

  useEffect(() => {
    let active = true
    void getMyProfile().then((profile) => {
      if (active) setState({ loading: false, profile, error: null })
    }).catch((error: unknown) => {
      if (active) setState({ loading: false, profile: null,
        error: error instanceof DataAccessError ? error.message : 'Could not load your profile.' })
    })
    return () => { active = false }
  }, [])

  // loading: spinner; error: retry message; profile === null: onboarding.
  return state
}
