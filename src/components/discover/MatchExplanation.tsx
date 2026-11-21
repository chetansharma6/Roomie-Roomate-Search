import type { MatchResult, MatchSource, RoommateProfile } from '../../types/profile.js';
import { SourceBadge } from './SourceBadge.js';
import { pretty, scoreTone } from './labels.js';

interface Props {
  profile: RoommateProfile;
  match: MatchResult;
  source: MatchSource;
  model?: string;
  disclaimer: string;
  onClose: () => void;
}

function List({ title, items, icon, tone }: { title: string; items: string[]; icon: string; tone: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-5">
      <h4 className={`text-sm font-semibold ${tone}`}>{title}</h4>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className={tone}>{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MatchExplanation({ profile, match, source, model, disclaimer, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Match details for ${profile.displayName}`} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{profile.displayName}</h3>
            <p className="text-xs text-slate-500">{pretty(profile.housingStatus)} · {profile.distanceFromCampusMiles} mi from campus</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`rounded-xl px-4 py-2 text-2xl font-bold ring-1 ${scoreTone(match.compatibilityScore)}`}>
            {match.compatibilityScore}% <span className="text-sm font-medium">Compatibility</span>
          </span>
          <SourceBadge source={source} model={model} />
        </div>
        <p className="mt-3 text-sm text-slate-700">{match.summary}</p>

        <List title="Why this match works" items={match.strengths.slice(0, 3)} icon="✓" tone="text-emerald-700" />
        <List title="Potential concerns" items={match.potentialConflicts} icon="!" tone="text-amber-700" />
        <List title="Questions to discuss before moving in" items={match.conversationStarters.slice(0, 3)} icon="?" tone="text-indigo-700" />

        <p className="mt-6 border-t border-slate-100 pt-3 text-xs text-slate-500">{disclaimer}</p>
      </div>
    </div>
  );
}
