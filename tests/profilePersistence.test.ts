import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileWrite } from '../src/types/database'

const mocks = vi.hoisted(() => ({
  getAuthClient: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../src/lib/auth', () => ({ getAuthClient: mocks.getAuthClient }))

import { createProfile } from '../src/lib/profilePersistence'

const profile: ProfileWrite = {
  display_name: 'Student',
  major: null,
  academic_year: null,
  bio: null,
  budget_min: 500,
  budget_max: 900,
  distance_from_campus_miles: 3,
  roommates_wanted: 2,
  move_in_date: '2027-08-01',
  cleanliness: null,
  sleep_schedule: null,
  noise_tolerance: null,
  pet_preference: null,
  monthly_rent: null,
  room_type: null,
  study_environment: null,
  guest_frequency: null,
  smoking: null,
  dealbreakers: [],
  housing_status: 'need_room',
  interests: [],
  is_active: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.insert.mockResolvedValue({ error: null })
  mocks.from.mockReturnValue({ insert: mocks.insert })
  mocks.getAuthClient.mockResolvedValue({ from: mocks.from })
})

describe('createProfile', () => {
  it('inserts the authenticated user id with only writable profile fields', async () => {
    await createProfile('student-id', profile)

    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(mocks.insert).toHaveBeenCalledWith({ id: 'student-id', ...profile })
  })

  it('propagates Supabase write errors', async () => {
    const error = new Error('database unavailable')
    mocks.insert.mockResolvedValue({ error })

    await expect(createProfile('student-id', profile)).rejects.toBe(error)
  })
})
