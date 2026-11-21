import type { ProfileFilters } from '../../types/profile.js';

interface Props {
  filters: ProfileFilters;
  onChange: (next: ProfileFilters) => void;
  onReset: () => void;
}

const field = 'roomie-filter-field';

function numberOrUndefined(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function FilterPanel({ filters, onChange, onReset }: Props) {
  const set = (patch: Partial<ProfileFilters>) => onChange({ ...filters, ...patch });
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1" onSubmit={(e) => e.preventDefault()} aria-label="Roommate filters">
      <label className="text-sm font-medium text-slate-700">
        Max monthly budget ($)
        <input type="number" min={0} step={25} inputMode="numeric" className={field} placeholder="Any"
          value={filters.maxMonthlyBudget ?? ''} onChange={(e) => set({ maxMonthlyBudget: numberOrUndefined(e.target.value) })} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Max distance from campus (mi)
        <input type="number" min={0} step={0.5} inputMode="decimal" className={field} placeholder="Any"
          value={filters.maxDistanceMiles ?? ''} onChange={(e) => set({ maxDistanceMiles: numberOrUndefined(e.target.value) })} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Housing status
        <select className={field} value={filters.housingStatus ?? ''}
          onChange={(e) => set({ housingStatus: (e.target.value || undefined) as ProfileFilters['housingStatus'] })}>
          <option value="">Any</option>
          <option value="has_room">Has a room to share</option>
          <option value="needs_room">Needs a room</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Roommates wanted
        <select className={field} value={filters.roommatesWanted ?? ''}
          onChange={(e) => set({ roommatesWanted: numberOrUndefined(e.target.value) })}>
          <option value="">Any</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Move-in timing
        <select className={field} value={filters.moveInWithinDays ?? ''}
          onChange={(e) => set({ moveInWithinDays: numberOrUndefined(e.target.value) })}>
          <option value="">Within 2 months of mine (default)</option>
          <option value="14">Within 2 weeks</option>
          <option value="30">Within 1 month</option>
          <option value="90">Within 3 months</option>
          <option value="3650">Any time</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:self-end">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={filters.verifiedOnly ?? false}
          onChange={(e) => set({ verifiedOnly: e.target.checked || undefined })} />
        University email verified only
      </label>
      <button type="button" onClick={onReset} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
        Reset filters
      </button>
    </form>
  );
}
