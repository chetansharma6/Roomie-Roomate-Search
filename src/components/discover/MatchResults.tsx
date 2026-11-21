import type { MatchResponse, MatchResult, RoommateProfile } from '../../types/profile.js';
import { MatchCard } from './MatchCard.js';

export interface ResultItem {
  profile: RoommateProfile;
  match?: MatchResult;
}

interface Props {
  items: ResultItem[];
  source: MatchResponse['source'] | 'unscored';
  selectedId?: string;
  onOpen: (profileId: string) => void;
}

export function MatchResults({ items, source, selectedId, onOpen }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-medium text-slate-800">No roommates match these filters.</p>
        <p className="mt-1 text-sm text-slate-500">Try raising your budget, increasing the distance, or widening the move-in timing.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(({ profile, match }) => (
        <MatchCard key={profile.id} profile={profile} match={match} source={source} selected={selectedId === profile.id} onOpen={() => onOpen(profile.id)} />
      ))}
    </div>
  );
}
