import type { FormEvent } from 'react'

export type HousingValues = {
  displayName: string
  bio: string
  photoUrl: string
  budgetMin: string
  budgetMax: string
  distance: string
  roommatesWanted: string
  moveInDate: string
  housingStatus: '' | 'have_room' | 'need_room'
  monthlyRent: string
}

export const initialHousing: HousingValues = {
  displayName: '',
  bio: '',
  photoUrl: '',
  budgetMin: '',
  budgetMax: '',
  distance: '',
  roommatesWanted: '1',
  moveInDate: '',
  housingStatus: '',
  monthlyRent: '',
}

export function HousingSetup({ form, update, onSubmit }: {
  form: HousingValues
  update: <K extends keyof HousingValues>(key: K, value: HousingValues[K]) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="profile-form" id="onboarding-housing" onSubmit={onSubmit}>
      <div className="profile-fields">
        <label>Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} maxLength={100} required /></label>
        <label>Housing situation<select value={form.housingStatus} onChange={(event) => update('housingStatus', event.target.value as HousingValues['housingStatus'])} required>
          <option value="">Choose one</option><option value="need_room">I need a room</option><option value="have_room">I have a room</option>
        </select></label>
        <label>Minimum monthly budget ($)<input type="number" min="0" max="100000" step="1" value={form.budgetMin} onChange={(event) => update('budgetMin', event.target.value)} required /></label>
        <label>Maximum monthly budget ($)<input type="number" min="0" max="100000" step="1" value={form.budgetMax} onChange={(event) => update('budgetMax', event.target.value)} required /></label>
        <label>Maximum distance from campus (miles)<input type="number" min="0" max="1000" step="0.1" value={form.distance} onChange={(event) => update('distance', event.target.value)} required /></label>
        <label>Roommates wanted<input type="number" min="1" max="20" step="1" value={form.roommatesWanted} onChange={(event) => update('roommatesWanted', event.target.value)} required /></label>
        <label>Move-in date<input type="date" value={form.moveInDate} onChange={(event) => update('moveInDate', event.target.value)} required /></label>
        {form.housingStatus === 'have_room' && <label>Monthly rent for the room ($)<input type="number" min="0" max="100000" step="1" value={form.monthlyRent} onChange={(event) => update('monthlyRent', event.target.value)} /></label>}
      </div>
      <label>Bio<textarea value={form.bio} onChange={(event) => update('bio', event.target.value)} maxLength={2000} rows={4} /></label>
      <label>Profile photo URL (optional)<input type="url" pattern="https://.*" maxLength={2048}
        placeholder="https://…" value={form.photoUrl} onChange={(event) => update('photoUrl', event.target.value)} /></label>
    </form>
  )
}
