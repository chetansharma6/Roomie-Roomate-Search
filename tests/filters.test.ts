import { describe, expect, it } from 'vitest';
import { DEMO_PROFILES, DEMO_STUDENT } from '../src/data/demoProfiles.js';
import { budgetsCompatible, filterCandidates } from '../src/lib/filters.js';
import { makeProfile } from './helpers.js';

const me = makeProfile({ id: 'me', budgetMin: 700, budgetMax: 900 });
const ids = (list: { id: string }[]) => list.map((p) => p.id).sort();

describe('budget filtering', () => {
  it('uses actual rent for a room offer, not the candidate budget max', () => {
    const cheapRoomBigBudget = makeProfile({ id: 'a', housingStatus: 'has_room', monthlyRent: 800, budgetMin: 1500, budgetMax: 2000 });
    const pricyRoom = makeProfile({ id: 'b', housingStatus: 'has_room', monthlyRent: 1000, budgetMin: 500, budgetMax: 600 });
    expect(budgetsCompatible(me, cheapRoomBigBudget)).toBe(true);
    expect(budgetsCompatible(me, pricyRoom)).toBe(false);
  });
  it('uses range overlap when nobody states rent', () => {
    expect(budgetsCompatible(me, makeProfile({ id: 'c', budgetMin: 880, budgetMax: 1200 }))).toBe(true);
    expect(budgetsCompatible(me, makeProfile({ id: 'd', budgetMin: 950, budgetMax: 1200 }))).toBe(false);
  });
  it('maxMonthlyBudget filter compares rent or lowest budget', () => {
    const pool = [
      makeProfile({ id: 'rent900', housingStatus: 'has_room', monthlyRent: 900 }),
      makeProfile({ id: 'rent700', housingStatus: 'has_room', monthlyRent: 700 }),
      makeProfile({ id: 'seeker', budgetMin: 650, budgetMax: 800 }),
    ];
    expect(ids(filterCandidates(pool, { maxMonthlyBudget: 750 }))).toEqual(['rent700', 'seeker']);
  });
});

describe('distance, status, roommates, move-in', () => {
  const pool = [
    makeProfile({ id: 'near', distanceFromCampusMiles: 1 }),
    makeProfile({ id: 'far', distanceFromCampusMiles: 8 }),
    makeProfile({ id: 'room', housingStatus: 'has_room', monthlyRent: 800, roommatesWanted: 3 }),
    makeProfile({ id: 'late', moveInDate: '2027-11-01' }),
  ];
  it('filters by distance', () => {
    expect(ids(filterCandidates(pool, { maxDistanceMiles: 3 }))).not.toContain('far');
  });
  it('filters by housing status and roommates', () => {
    expect(ids(filterCandidates(pool, { housingStatus: 'has_room' }))).toEqual(['room']);
    expect(ids(filterCandidates(pool, { roommatesWanted: 3 }))).toEqual(['room']);
  });
  it('filters by move-in window, defaulting to 60 days from the requester', () => {
    expect(ids(filterCandidates(pool, {}, me))).not.toContain('late');
    expect(ids(filterCandidates(pool, { moveInWithinDays: 3650 }, me))).toContain('late');
  });
  it('combines multiple filters with AND', () => {
    expect(ids(filterCandidates(pool, { maxDistanceMiles: 3, housingStatus: 'needs_room', moveInWithinDays: 30 }, me))).toEqual(['near']);
  });
});

describe('hard constraints and candidate exclusion', () => {
  it('excludes the requester, other universities, and has_room pairs', () => {
    const owner = makeProfile({ id: 'owner', housingStatus: 'has_room', monthlyRent: 800 });
    const pool = [me, makeProfile({ id: 'ucf', universityId: 'ucf' }), makeProfile({ id: 'ok' }), owner];
    expect(ids(filterCandidates(pool, {}, me))).toEqual(['ok', 'owner']);
    expect(ids(filterCandidates(pool, {}, owner))).toEqual(['me', 'ok']);
  });
  it('applies dealbreakers mutually', () => {
    const smoker = makeProfile({ id: 's', smoking: 'smoker' });
    const wantsSmokeFree = makeProfile({ id: 'n', dealbreakers: ['no_smoking'] });
    expect(filterCandidates([smoker], {}, wantsSmokeFree)).toHaveLength(0);
    expect(filterCandidates([wantsSmokeFree], {}, smoker)).toHaveLength(0);
  });
  it('removes incompatible room types', () => {
    const shared = makeProfile({ id: 'sh', roomType: 'shared' });
    expect(filterCandidates([shared], {}, makeProfile({ id: 'x', roomType: 'private' }))).toHaveLength(0);
    expect(filterCandidates([shared], {}, makeProfile({ id: 'y', roomType: 'either' }))).toHaveLength(1);
  });
});

describe('missing optional values', () => {
  it('does not exclude sparse profiles on lifestyle filters', () => {
    const sparse = makeProfile({ id: 'sparse' });
    expect(filterCandidates([sparse], { cleanliness: ['tidy'], sleepSchedule: ['early_bird'] })).toHaveLength(1);
    expect(filterCandidates([makeProfile({ id: 'x', cleanliness: 'relaxed' })], { cleanliness: ['tidy'] })).toHaveLength(0);
  });
  it('ignores unparseable dates instead of crashing', () => {
    expect(filterCandidates([makeProfile({ id: 'bad', moveInDate: 'soon' })], {}, me)).toHaveLength(1);
  });
});

describe('demo data', () => {
  it('has at least 12 fictional profiles and the smoker/expensive/far ones are excluded for the demo student', () => {
    expect(DEMO_PROFILES.length).toBeGreaterThanOrEqual(12);
    const result = ids(filterCandidates(DEMO_PROFILES, {}, DEMO_STUDENT));
    expect(result).toContain('demo-maya');
    expect(result).toContain('demo-tyler');
    for (const excluded of ['demo-cole', 'demo-priya', 'demo-grace', 'demo-you']) expect(result).not.toContain(excluded);
  });
});
