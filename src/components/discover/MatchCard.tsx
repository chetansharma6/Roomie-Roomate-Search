import type { MatchResult, MatchSource, RoommateProfile } from '../../types/profile.js';
import { pretty, priceLabel, scoreTone } from './labels.js';

interface Props {
  profile: RoommateProfile;
  match?: MatchResult;
  source: MatchSource | 'unscored';
  selected?: boolean;
  onOpen: () => void;
}

export function MatchCard({ profile, match, source, selected, onOpen }: Props) {
  return (
    <article className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition ${selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{profile.displayName}</h3>
          <p className="text-xs text-slate-500">
            {pretty(profile.housingStatus)} · {profile.distanceFromCampusMiles} mi from campus
            {profile.verification === 'university_email_verified' && ' · University email verified'}
          </p>
        </div>
        {match && (
          <div className="text-right">
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ring-1 ${scoreTone(match.compatibilityScore)}`}
              aria-label={`${match.compatibilityScore}% estimated compatibility`}>
              {match.compatibilityScore}%
            </span>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {source === 'gemini' ? 'AI estimate' : 'baseline estimate'}
            </p>
          </div>
        )}
      </header>
      <p className="mt-2 text-sm text-slate-600">{profile.bio.length > 140 ? `${profile.bio.slice(0, 140)}…` : profile.bio}</p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <div>{priceLabel(profile)}</div>
        <div>Move-in {profile.moveInDate}</div>
        <div>{profile.roommatesWanted} roommate{profile.roommatesWanted === 1 ? '' : 's'}</div>
      </dl>
      {match && <p className="mt-3 text-sm text-slate-700">{match.summary}</p>}
      <button type="button" onClick={onOpen} className="mt-4 self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
        {match ? 'View match details' : 'View profile'}
      </button>
    </article>
  );
}
