import type { RoommateProfile } from '../../types/profile.js';

export const pretty = (v: string | undefined): string => (v ? v.replace(/_/g, ' ') : 'not specified');

export function scoreTone(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 ring-amber-200';
  return 'bg-rose-100 text-rose-800 ring-rose-200';
}

export function priceLabel(p: RoommateProfile): string {
  return p.housingStatus === 'has_room' && p.monthlyRent !== undefined
    ? `$${p.monthlyRent}/mo rent`
    : `$${p.budgetMin}–$${p.budgetMax}/mo budget`;
}
