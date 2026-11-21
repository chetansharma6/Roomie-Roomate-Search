import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_PROFILES, DEMO_STUDENT } from '../data/demoProfiles.js';
import { FilterPanel } from '../components/discover/FilterPanel.js';
import { matchingDemoHabits } from '../demo/matchingLifestyle';
import { MatchExplanation } from '../components/discover/MatchExplanation.js';
import { MatchResults, type ResultItem } from '../components/discover/MatchResults.js';
import { MatchingLoadingState } from '../components/discover/MatchingLoadingState.js';
import { SourceBadge } from '../components/discover/SourceBadge.js';
import { filterCandidates } from '../lib/filters.js';
import { MatchClientError, describeFallback, findMatches } from '../lib/matchClient.js';
import { rankBaseline } from '../lib/scoring.js';
import type { MatchResponse, ProfileFilters, RoommateProfile } from '../types/profile.js';

export interface DiscoverProps {
  /** Signed-in student's profile. Defaults to the fictional demo student. */
  currentUser?: RoommateProfile | null;
  /** Profiles to browse. Defaults to fictional demo data; pass Supabase rows later. */
  profiles?: RoommateProfile[];
  /** Supabase access token for /api/match (omit in demo mode). */
  accessToken?: string;
  /** Sends demoStudentId so the server's demo mode can identify the fictional student. */
  demoMode?: boolean;
}

type Sort = 'compatibility' | 'price' | 'distance';

export default function Discover({
  currentUser = DEMO_STUDENT,
  profiles = DEMO_PROFILES,
  accessToken,
  demoMode = currentUser?.id === DEMO_STUDENT.id && !accessToken,
}: DiscoverProps) {
  const [filters, setFilters] = useState<ProfileFilters>({});
  const [sort, setSort] = useState<Sort>('compatibility');
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false); // collapsed by default on small screens
  const [openId, setOpenId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  // Signed in without local profile data: the server loads everything and returns the cards.
  const serverMode = !currentUser && Boolean(accessToken);
  const [missingProfile, setMissingProfile] = useState(false);
  const pool = useMemo(() => (serverMode ? (response?.profiles ?? []) : profiles), [serverMode, response, profiles]);

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const eligible = useMemo(
    () => (currentUser ? filterCandidates(profiles, { ...filters, universityId: currentUser.universityId }, currentUser) : []),
    [profiles, filters, currentUser],
  );

  // Before the AI runs, show instant deterministic scores (labelled as baseline).
  const baseline = useMemo(() => (currentUser ? rankBaseline(currentUser, eligible) : []), [currentUser, eligible]);
  const activeMatches = response ? response.matches : baseline;

  const items: ResultItem[] = useMemo(() => {
    const list = activeMatches.flatMap((match) => {
      const profile = byId.get(match.profileId);
      return profile ? [{ profile, match }] : [];
    });
    const price = (p: RoommateProfile) => (p.housingStatus === 'has_room' ? (p.monthlyRent ?? p.budgetMin) : p.budgetMin);
    if (sort === 'price') list.sort((a, b) => price(a.profile) - price(b.profile));
    if (sort === 'distance') list.sort((a, b) => a.profile.distanceFromCampusMiles - b.profile.distanceFromCampusMiles);
    return list;
  }, [activeMatches, byId, sort]);

  const changeFilters = (next: ProfileFilters) => {
    setFilters(next);
    if (!serverMode) setResponse(null); // previous AI results no longer reflect the filters
    setError(null);
  };

  const runMatching = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await findMatches({
        requester: currentUser,
        candidates: profiles,
        filters,
        accessToken,
        demoStudentId: demoMode ? currentUser?.id : undefined,
      });
      if (seq === requestSeq.current) setResponse(result);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      if (e instanceof MatchClientError && e.kind === 'missing_profile') setMissingProfile(true);
      setError(e instanceof MatchClientError ? e.message : 'Something went wrong while matching. Please try again.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [currentUser, profiles, filters, accessToken, demoMode]);

  // Server mode has nothing to show until a request runs, so run on mount and whenever filters change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/filter-change; setState happens after await
    if (serverMode) void runMatching();
  }, [serverMode, runMatching]);

  const opened = openId ? items.find((i) => i.profile.id === openId) : undefined;

  if (!currentUser && (!serverMode || missingProfile)) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold">Create your profile first</h1>
          <p className="mt-1 text-sm text-slate-700">Roomie needs your housing needs and lifestyle preferences before it can find compatible roommates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matching-page mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discover roommates</h1>
          <p className="text-sm text-slate-500">
            {demoMode ? 'Demo mode: all students shown are fictional. ' : ''}
            Hard housing filters narrow the list; compatibility ranks what is left.
          </p>
        </div>
        <button type="button" onClick={runMatching} disabled={loading || (!serverMode && eligible.length === 0)}
          className="button button-primary disabled:cursor-not-allowed disabled:opacity-50">
          ✦ Find My AI Matches
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="filter-panel"
            className="flex min-h-11 w-full items-center justify-between text-sm font-semibold uppercase tracking-wide text-slate-500 lg:pointer-events-none lg:mb-3 lg:min-h-0">
            <span>Filters{Object.values(filters).some((v) => v !== undefined) ? ' (active)' : ''}</span>
            <span aria-hidden className="lg:hidden">{filtersOpen ? '−' : '+'}</span>
          </button>
          <div id="filter-panel" className={`${filtersOpen ? 'mt-3 block' : 'hidden'} lg:block`}>
            <FilterPanel filters={filters} onChange={changeFilters} onReset={() => changeFilters({})} />
          </div>
        </aside>

        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{items.length} {items.length === 1 ? 'student' : 'students'}</span>
              {response ? <SourceBadge source={response.source} model={response.model} /> : <span className="text-slate-400">· baseline scores — run AI matching for deeper analysis</span>}
            </div>
            <label className="text-sm text-slate-600">
              Sort by{' '}
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-10 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
                <option value="compatibility">Compatibility</option>
                <option value="price">Price (low to high)</option>
                <option value="distance">Distance from campus</option>
              </select>
            </label>
          </div>

          {response?.source === 'fallback' && response.matches.length > 0 && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              {describeFallback(response.fallbackReason)}
            </p>
          )}
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</p>}

          {loading ? (
            <MatchingLoadingState />
          ) : (
            <MatchResults items={items} source={response ? response.source : 'unscored'} selectedId={openId ?? undefined} onOpen={setOpenId} />
          )}
        </section>
      </div>

      {opened?.match && (
        <MatchExplanation
          profile={opened.profile}
          match={opened.match}
          source={response ? response.source : 'fallback'}
          model={response?.model}
          disclaimer={response?.disclaimer ?? 'Compatibility scores are estimates to start a conversation, not predictions of roommate success.'}
          onClose={() => setOpenId(null)}
          demoHabits={demoMode ? matchingDemoHabits[opened.profile.id] : undefined}
        />
      )}
    </div>
  );
}
