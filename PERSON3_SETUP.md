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
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | server (the `VITE_` ones are shared with the browser client) | Real auth + profile loading when demo mode is off. Names match the team's `.env.example` |

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

The repo contains **no** Person 2 schema, so the table below is the *contract the matcher expects*, implemented in `src/lib/profileMapper.ts` (`rowToProfile`). Either make your `profiles` table match it, or edit only `rowToProfile` (the adapter); do not change the matching algorithm. Rows missing a required column are skipped.

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
2. The server verifies the token with Supabase Auth (`/auth/v1/user`), takes the user id **from the token** (never the request body), loads that profile, then lists profiles with the same `university_id` (service key, server only). Cross-university candidates are impossible.
3. Hard filters run (budget, distance, housing status, move-in window, dealbreakers, optional `verifiedOnly`), then up to 10 candidates go to Gemini.
4. **Privacy:** the browser never needs the service key. If you pass `profiles` to `<Discover />` from the client, load them with RLS so students only see same-university rows, and never include email/phone columns.
5. Recommended RLS: authenticated users may `select` profiles where `university_id` equals their own; users may `update` only their own row; only the server may write `verified_university_email`.

### Steps

1. Create/align the table above; set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `GEMINI_API_KEY`; set `ROOMIE_DEMO_MODE=false`.
2. **Signed-in (server-resolved) mode, already wired:** render `<Discover currentUser={null} accessToken={session.access_token} />` (as `SignIn.tsx` does). Discover posts only the token and filters to `/api/match`; the server loads the student and same-university candidates and returns sanitized candidate cards in `response.profiles` (no email/phone; bio capped at 600 chars). Discover runs automatically on mount and whenever filters change, shows "Create your profile" on a 404, and has no client-side baseline in this mode (the server's fallback ranking is used instead). Passing `currentUser` + `profiles` still works for the client-filtered mode.
3. To replace demo data, stop passing/using `DEMO_PROFILES`; nothing else changes.
4. Caveat: the Supabase code path follows the documented REST APIs but has **not been run against a live project**.

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
