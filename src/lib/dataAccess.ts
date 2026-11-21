import { getAuthClient, getCurrentUser, RoomieAuthError } from './auth'

export type DataAccessErrorCode = 'unauthenticated' | 'validation' | 'forbidden' | 'duplicate' | 'not_found' | 'network' | 'database'

export class DataAccessError extends Error {
  constructor(public readonly code: DataAccessErrorCode, message: string) {
    super(message)
    this.name = 'DataAccessError'
  }
}

export function databaseError(error: { code?: string }): DataAccessError {
  if (error.code === '23505') return new DataAccessError('duplicate', 'This record or roommate request already exists.')
  if (error.code === '42501') return new DataAccessError('forbidden', 'You are not allowed to perform this action.')
  if (error.code === '23514' || error.code === '23502' || error.code === '22P02') return new DataAccessError('validation', 'The supplied data does not meet the database requirements.')
  return new DataAccessError('database', 'Could not complete the request. Please try again.')
}

type Context = { client: Awaited<ReturnType<typeof getAuthClient>>; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }

/** Uses the existing browser SDK session; never uses a database secret key. */
export async function withDataAccess<T>(operation: (context: Context) => Promise<T>): Promise<T> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new DataAccessError('unauthenticated', 'Sign in with your confirmed university email to continue.')
    return await operation({ user, client: await getAuthClient() })
  } catch (error) {
    if (error instanceof DataAccessError) throw error
    if (error instanceof RoomieAuthError) {
      const code = ['email_not_confirmed', 'unsupported_domain'].includes(error.code) ? 'forbidden' : 'unauthenticated'
      throw new DataAccessError(code, 'Sign in with your confirmed supported university email to continue.')
    }
    if (error instanceof TypeError) throw new DataAccessError('network', 'Could not reach the service. Check your connection and retry.')
    throw new DataAccessError('database', 'Could not complete the request. Please try again.')
  }
}
