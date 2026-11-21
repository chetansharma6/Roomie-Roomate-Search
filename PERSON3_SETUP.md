# Person 3 — Gemini Roommate Matching

## What was implemented

- Shared `RoommateProfile` type, 14 fictional USF demo profiles (incl. a strong match, a conflict match, a sparse profile, and a prompt-injection bio).
- Deterministic hard filters (university, budget, distance, housing status, roommates, move-in window, room type, dealbreakers).
- Weighted baseline compatibility score (0–100, adjustable weights) that also powers the fallback.
- `POST /api/match`: server-side Gemini analysis with a JSON schema, Zod validation, and automatic fallback.
- Discovery UI (`Discover` page + `FilterPanel`, `MatchCard`, `MatchResults`, `MatchExplanation`, `MatchingLoadingState`) with a **Find My AI Matches** button.
- Tests (Vitest, Gemini SDK mocked) and a dev-only live smoke script.

Merged with the team's Supabase-auth scaffold from `main`: their `index.html`, `.gitignore`, `src/styles.css` and auth UI are kept. My additions on top: Tailwind v4 (`src/index.css` imports their `styles.css` into the `base` layer so Tailwind utilities win), `tsconfig.server.json` (for `api/`, `tests/`, `scripts/`), a `Discover` entry in `src/App.tsx`, and the Vite config's Tailwind + local `/api` plugins.

## Files

Created: `vercel.json`, `tsconfig.server.json`, `PERSON3_SETUP.md`. Merged with team files: `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `.gitignore`, `src/App.tsx`, `src/main.tsx`
`src/`: `index.css`, `types/profile.ts`, `data/demoProfiles.ts`, `lib/{filters,scoring,matchSchema,matchClient,profileRepository,profileMapper}.ts`, `pages/Discover.tsx`, `components/discover/*`
`api/`: `match.ts`, `_lib/{matchService,gemini,prompt,supabase}.ts`
`tests/`, `scripts/smoke-gemini.ts`.

## Dependencies

Runtime: `@google/genai`, `zod`, `react`, `react-dom`. Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `tailwindcss`, `@tailwindcss/vite`, `@vercel/node`, `tsx`, type packages.

## Environment variables

See `.env.example`. Put real values in `.env.local` (git-ignored).

| Variable | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | server only | Never use a `VITE_` prefix |
| `GEMINI_MODEL` | server | Default `gemini-3.5-flash-lite` |
| `ROOMIE_DEMO_MODE` | server | `true` enables the fictional unauthenticated student. **Ignored when `VERCEL_ENV=production`** (or `NODE_ENV=production` off Vercel) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | shared browser/server configuration | Real auth + profile loading when demo mode is off. Database reads use the caller's JWT and respect RLS; no secret key is needed for matching |

## Local development

```bash
npm install
cp .env.example .env.local   # then edit; set GEMINI_API_KEY
npm run dev                  # Vite also serves /api/match locally (no Vercel login needed)
npm test                     # automated tests (no network)
npm run build
npm run smoke:gemini         # DEV ONLY: one real Gemini call using GEMINI_API_KEY
npm run dev:vercel           # optional: run via `vercel dev` instead
```

Without a key the app still works: results come back labelled "Baseline match · not AI".

## Get a Gemini API key

Create one in [Google AI Studio](https://aistudio.google.com/apikey), put it in `.env.local` as `GEMINI_API_KEY`, then run `npm run smoke:gemini`. It prints per-candidate scores and never prints the key.

## Person 2 — connecting Supabase

Person 2's schema and RLS are in `supabase/migrations/20261121200000_roomie_profiles_requests.sql`, with SQL Editor instructions and the database test checklist in `supabase/DATABASE_SETUP.txt`. All five migrations, including the optional photo and lifestyle-detail columns, were applied to hosted project `xcelqqmncgeveawkumje` on 2026-11-21. All tables have RLS enabled; hosted transactional policy checks passed and signed-out Data API requests were denied. **Matching through a real student session is still unverified.**

The profile migrations provide the columns consumed by `src/lib/profileMapper.ts` (`rowToProfile`), including optional `monthly_rent`, `room_type`, `study_environment`, `guest_frequency`, `smoking`, and `dealbreakers`. `move_in_date` is nullable for drafts in storage, but required by the mapper for discovery. `university`, `university_id`, and `verified_university_email` are database-derived. `is_active` controls discoverability.

If a deployed schema uses different names, update the mapper **and** the explicit column projection/query filters in `api/_lib/supabase.ts` as necessary. A mapper change alone cannot fix PostgREST selecting or filtering a nonexistent column.

### Expected `public.profiles` columns

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid / text | yes | Must equal `auth.users.id` (the API uses the token's user id to find the requester) |
| `university_id` | text | yes | e.g. `usf`. Candidates are only ever listed from the requester's university |
| `display_name` | text | yes | Shown in UI, never sent to Gemini |
| `bio` | text | no | Untrusted free text, truncated to 600 chars before Gemini |
| `budget_min`, `budget_max` | numeric | yes | Monthly USD |
| `distance_from_campus_miles` | numeric | yes | (`distance_max_miles` also accepted) |
| `move_in_date` | date | yes | `YYYY-MM-DD` |
| `roommates_wanted` | int | yes | |
| `housing_status` | text | yes | `has_room` / `needs_room` (`have_room`, `need_room` accepted) |
| `verified_university_email` | boolean | no | `true` → "verified" badge; `verifiedOnly` filter uses it. Set server-side, never from user input |
| `monthly_rent` | numeric | no | `has_room` only |
| `room_type` | text | no | `private` / `shared` / `either` |
| `cleanliness` | text | no | `relaxed` / `moderate` / `tidy` / `very_tidy` |
| `sleep_schedule` | text | no | `early_bird` / `flexible` / `night_owl` |
| `noise_tolerance` | text | no | `quiet` / `moderate` / `lively` |
| `study_environment` | text | no | `silent` / `quiet` / `background_noise_ok` / `away_from_home` |
| `guest_frequency` | text | no | `never` / `rarely` / `sometimes` / `often` |
| `pet_preference` | text | no | `no_pets` / `pets_ok` / `has_pets` |
| `smoking` | text | no | `smoke_free` / `outside_only` / `smoker` |
| `interests` | text[] | no | |
| `dealbreakers` | text[] | no | any of `no_smoking`, `no_pets`, `no_frequent_guests` |
| `major`, `academic_year` | text | no | Display only; never scored or sent to Gemini |

Optional columns that are null or hold an unrecognised value are treated as "not provided" (skipped in scoring, never penalised). Unknown columns, including `email`, are never copied.

### How it flows

1. Student signs in (Supabase Auth). The client sends `Authorization: Bearer <session.access_token>` to `POST /api/match`.
2. The server verifies the token and email confirmation with Supabase Auth (`/auth/v1/user`), takes the user id **from the token** (never the request body), loads that active profile, then lists active profiles with the same `university_id`. All database calls use the publishable key and caller's JWT, so the applied RLS policies enforce verified access and university isolation.
3. Hard filters run (budget, distance, housing status, move-in window, dealbreakers, optional `verifiedOnly`), then up to 10 candidates go to Gemini.
4. **Privacy:** the browser never needs the service key. If you pass `profiles` to `<Discover />` from the client, load them with RLS so students only see same-university rows, and never include email/phone columns.
5. Recommended RLS: authenticated users may `select` profiles where `university_id` equals their own; users may `update` only their own row; only the server may write `verified_university_email`.

### Steps

1. Apply all migrations in the order documented in `supabase/DATABASE_SETUP.txt`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ALLOWED_EMAIL_DOMAINS=usf.edu`, and server-only `GEMINI_API_KEY`; set `ROOMIE_DEMO_MODE=false` and restart the dev server.
2. The shared AuthProvider restores the confirmed user and routes them to `/onboarding` or `/discover` based on profile existence. `StudentDiscover` in `src/pages/AuthenticatedRoutes.tsx` loads RLS-scoped profiles, maps them with `rowToProfile`, and passes `currentUser`, `profiles`, and the session token to Discover. Onboarding saves the matching preferences through `src/lib/profilePersistence.ts`.
   Discover also supports **server-resolved mode** via `<Discover currentUser={null} accessToken={session.access_token} />`, used by the account screen: it sends only the token/filters and receives sanitized candidate cards in `response.profiles` (no email/phone; bio capped at 600 characters). Both modes retain the existing matching algorithm and respect the same database RLS.
3. To replace demo data, stop passing/using `DEMO_PROFILES`; nothing else changes.
4. Caveat: the Supabase code path follows the documented REST APIs but has **not been run against a live project**.

### Real Supabase acceptance test (pending)

1. Confirm the migration succeeded in the hosted project and enable the signup hook. Run the database checklist with user sessions; the SQL Editor's administrator role bypasses RLS.
2. Sign in using two actual supported university mailboxes (A and B), confirm each email, and create an active profile for each account. Supply valid budgets, distance, roommate count, housing status, and a move-in date. Choose mutually compatible hard constraints so a nonempty result is expected. Never set the verified flag from the client.
3. Run the app with `ROOMIE_DEMO_MODE=false`. In an authenticated API client, call `POST /api/match` with JSON `{ "filters": {} }` and `Authorization: Bearer <A's session.access_token>`. Keep the token private and do not paste it in issues, screenshots, logs, or chat.
4. Require HTTP 200 with a nonempty `matches` array containing B's real profile UUID. Confirm A is excluded and all result UUIDs correspond to authorized, active database profiles. A 200 with no matches does not validate the full scenario.
5. `source: "gemini"` demonstrates AI analysis of those records. `source: "fallback"` with real records demonstrates database matching only; inspect `fallbackReason` before claiming the AI path works. A Gemini smoke test with fictional profiles does not validate Supabase.
6. Verify missing/invalid tokens receive 401; unconfirmed or unsupported accounts cannot retrieve profiles; inactive and other-university profiles are excluded. Check sender/receiver privacy separately using the database checklist.
7. Record the test date, migration version, HTTP status, result count, and response source without storing emails, tokens, or student profile contents. Only mark live integration verified after those checks succeed.

Current evidence: automated adapter tests, temporary local PostgreSQL checks, hosted transactional policy checks and signed-out HTTP checks pass. The migrations and signup hook are applied. Real mailbox sign-in, real student profile creation, and a real `/api/match` response remain unverified. `supabase/tests/roomie_rls.sql` is a repeatable hosted policy smoke test that rolls back synthetic fixtures; run with `npx supabase db query --remote --file supabase/tests/roomie_rls.sql --yes`.

## Real Supabase profiles + Gemini (integration summary)

Verified against `main` after Person 2's PR #19. No new application code was required; the integration already existed, so this branch only adds `tests/realProfilesIntegration.test.ts` and this section.

**Loading real profiles**
- Browser: `StudentDiscover` (`src/pages/AuthenticatedRoutes.tsx`) calls `getMyProfile()` and `listProfiles()` from `src/lib/profiles.ts`. Both use the signed-in session's client, so RLS decides what is visible. `listProfiles()` takes no arguments, requires a session (`unauthenticated` error otherwise), returns up to 500 active profiles excluding the caller, and selects an explicit column allowlist (`PROFILE_COLUMNS`, no email/phone).
- Rows are converted with `rowToProfile` (`src/lib/profileMapper.ts`). Rows missing a required field (e.g. a draft with no `move_in_date`) are dropped; missing optional fields stay `undefined` and are never invented. An own profile that is inactive or incomplete shows the "Complete your profile" onboarding message.

**Reaching Gemini**
1. "Find My AI Matches" / ranking calls `findMatches` (`src/lib/matchClient.ts`) with `Authorization: Bearer <session.access_token>` and only `{ filters }` in the body.
2. `POST /api/match` verifies the token with Supabase Auth, takes the user id from the token, and re-loads the requester and same-university candidates itself (`api/_lib/supabase.ts`, user JWT, RLS). Client-sent ids or universities are ignored. The client's own list is used only for local filtering/fallback and display.
3. Deterministic filters run first; then up to 10 candidates go to Gemini with lifestyle fields only (no email, name, budget, distance, or dates). Any Gemini failure falls back to baseline scoring.

**Schema compatibility** (checked field by field): `id`, `university_id`, `budget_min/max`, `distance_from_campus_miles`, `move_in_date`, `roommates_wanted`, `housing_status` (`have_room`/`need_room` normalised to `has_room`/`needs_room`), lifestyle enums and `verified_university_email` all match. No conflicts found. Note `move_in_date` is nullable in the database but required for discovery.

**Environment variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (browser and server), `GEMINI_API_KEY` (server only), optional `GEMINI_MODEL`, `ROOMIE_DEMO_MODE=false`. No service-role key is used anywhere.

**Testing with real students**: follow "Real Supabase acceptance test (pending)" above with two confirmed university accounts that each have a complete active profile.

**Remaining limitations**
- Not verified against a live Supabase project or real student accounts; automated tests use mocked Supabase REST.
- The `StudentDiscover` React component has no automated test (no jsdom/testing-library in the repo); its behaviour is covered by the underlying data-access, mapper and `/api/match` tests. Desktop/mobile layout was not visually checked.
- `listProfiles()` caps at 500 rows without pagination; the browser and server each fetch profiles (two reads per match).

## Person 1 — using the discovery UI

```tsx
import Discover from './pages/Discover';
// react-router example (or any router; Discover does not care):
<Route path="/discover" element={<Discover currentUser={profile} profiles={candidates} accessToken={session?.access_token} />} />
// No props at all = fully fictional USF demo (needs ROOMIE_DEMO_MODE=true on the server).
```

- **Props:** `currentUser`, `profiles`, `accessToken`, `demoMode` (all optional; types in `src/types/profile.ts`).
- **Self-contained:** it renders only its own content (a `max-w-6xl` container with a "Discover roommates" heading), no nav, header, footer or router code, so your layout/nav wraps it. It is responsive (filters stack above results on mobile, side panel on `lg`).
- **States:** loading skeleton, results, empty ("no matches") state, error banner, and a labelled fallback banner when Gemini is unavailable.
- **Needs:** `src/pages/Discover.tsx`, `src/components/discover/*`, `src/lib/{filters,scoring,matchClient,matchSchema}.ts`, `src/types/profile.ts`, `src/data/demoProfiles.ts` (default props only), and Tailwind v4 (`@tailwindcss/vite` plugin in `vite.config.ts`, `@import "tailwindcss"` in `src/index.css`). Existing `src/styles.css` is imported into the Tailwind `base` layer so Tailwind classes win over its global element styles (`button`, `main`, `input`).
- **API:** `src/lib/matchClient.ts#findMatches` calls `POST /api/match` with `{ filters, demoStudentId? }` and a bearer token; the browser never sees `GEMINI_API_KEY`. Responses are validated and fall back to local baseline scoring on any failure.
- **Avoiding conflicts:** don't edit files under `src/components/discover/`, `src/lib/{filters,scoring,match*}.ts`, `api/`. If your app also uses Tailwind, keep one `@import "tailwindcss"`. `src/App.tsx` currently toggles Discover with local state; replace it with your router.

## Demo script (fictional USF students only)

1. `npm run dev`, open the app → **Explore demo matches** (needs `ROOMIE_DEMO_MODE=true`) to reach Discover as "Jordan".
2. Set filters, e.g. max budget `$950`, max distance `3 mi`.
3. Click **✦ Find My AI Matches**; Gemini analyzes the eligible candidates and results are ranked, labelled "AI match · gemini-3.5-flash-lite".
4. Expect **Maya R.** near the top (early bird, tidy, quiet, smoke-free, hiking/cooking) and **Tyler B.** near the bottom (night owl, lively, frequent guests, relaxed cleaning, outdoor smoking).
5. Open a match: strengths, potential conflicts, conversation starters and the disclaimer.
6. Resilience: remove `GEMINI_API_KEY` (or set a wrong one) and click again. Results stay usable and are labelled "Baseline match · not AI" with a banner.

The prompt-injection profile lives in `ADVERSARIAL_TEST_PROFILES` (not in the demo list); it is used by tests only.

## Team: run, configure, test

```bash
npm install && cp .env.example .env.local   # fill in values; .env.local is git-ignored
npm run dev                                 # app + /api/match on one port
npm test && npm run build                   # no network
npm run smoke:gemini                        # optional, live call, needs GEMINI_API_KEY
```

Keep `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` out of any `VITE_` variable and out of git. Rotate the Gemini key if it was ever pasted into chat or a commit.

## Deploy to Vercel

Import the repo; add `GEMINI_API_KEY` (and Supabase vars) in project settings. `api/match.ts` deploys as a Vercel Function (30 s max, see `vercel.json`). For a hackathon demo on a **preview** deployment you may set `ROOMIE_DEMO_MODE=true`; it is refused on Production.

## Behaviour notes

- Hard constraints are enforced in code before Gemini sees anything; Gemini can only rank the (max 10) candidates it is given, and any unknown/duplicate ID, bad score or invalid JSON causes fallback.
- Names, major, academic year and verification are never sent to Gemini or scored. Housing logistics (budget, rent, distance, move-in date) are also **not sent**: they are enforced by deterministic filters, and Gemini's score is lifestyle-only (sleep, cleanliness, noise, study, guests, pets, smoking, household setup, interests).
- Bios are treated as untrusted data (delimited, sanitised, covered by the system instruction).

## Known limitations

- `npm run smoke:gemini` passed against the live `gemini-3.5-flash-lite` API (fictional demo data only); re-run it after changing the prompt or model.
- Rate limiting and the response cache are in-memory per serverless instance (best-effort). The client also caches unchanged requests.
- Gemini analyses the top 10 candidates by baseline score within a 20-second model timeout; the browser waits up to 25 seconds and the Vercel Function is capped at 30 seconds. In AI mode only those candidates are shown.
- The profile fields for lifestyle and `monthly_rent` are my proposal; Person 2 must confirm the schema.
- No pagination, saved matches, or messaging.

## QA notes (feature/gemini-qa)

### Scoring changes
- Direct clashes (smoke-free vs smoker, pet-free vs pet owner) cap the baseline score at 50; a severe clash in cleanliness, sleep, noise or guests caps it at 70 (`CONFLICT_CAPS` in `src/lib/scoring.ts`). Previously such pairs scored 86-94.
- Scores with little shared data (< 50% of weight covered) are pulled toward 50, so a near-empty profile is no longer a "100% match".

### Demo script (route `/matches`, `ROOMIE_DEMO_MODE=true`, fictional students only)
1. Open `/matches`: instant baseline scores, labelled "baseline scores".
2. Apply filters (e.g. max budget 800, distance 3 mi): the list narrows deterministically; Cole (smoker, filtered by dealbreaker) and Priya (over budget) never appear.
3. Click **Find My AI Matches**: badge becomes "Gemini-powered analysis". Open Maya (strong match: shared sleep/cleanliness) and Tyler (conflicts: night owl, lively, guests, relaxed cleanliness), then show "Questions to discuss".
4. To show the fallback honestly, remove `GEMINI_API_KEY` and restart: banner and "Baseline match · not AI" badge appear.
The prompt-injection profile (`ADVERSARIAL_TEST_PROFILES`) is not in `DEMO_PROFILES` and never appears in the demo.

### Remaining requirements for real Supabase integration (Person 2)
- A `profiles` table with the columns in `rowToProfile` (required: id, university_id, display_name, budget_min/max, distance_from_campus_miles, move_in_date, roommates_wanted, housing_status). Rows missing one are skipped silently.
- No secret key is needed: matching reads profiles with the caller's JWT, so RLS applies, and returns only public card fields.
- Mapper accepts `need_room/have_room` and `needs_room/has_room`; confirm which one the real table uses.
- Not yet exercised against a live Supabase project; only mocked REST is tested.

### Known limitations
- Gemini may return fewer candidates than sent; unreturned candidates are simply not shown (no mixing of AI and baseline results).
- Live Gemini checked with one smoke run (8 candidates): ranking sensible, no invented attributes or logistics observed. That is a single sample, not a guarantee.
- Touch targets in Person 1's navbar ("Roomie.", "Discover", "How it works") are 21-36px high; left untouched.
