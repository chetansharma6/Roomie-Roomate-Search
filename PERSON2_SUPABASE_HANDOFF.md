# Person 2 Supabase handoff

## Current status

Roomie's authenticated profile path uses Supabase Auth, PostgreSQL RLS, and the caller's JWT. The Vercel matching function does not use a service-role key. All five migrations, including `20261121220000_profile_photos.sql` and `20261121230000_profile_lifestyle_details.sql`, are applied to hosted project `xcelqqmncgeveawkumje` in timestamp order. The hosted `supabase/tests/roomie_rls.sql` smoke test passed and rolled back its synthetic fixtures. An anon-key read selecting `photo_url` returns `42501` (RLS) rather than `42703` (missing column); authenticated photo insert/update column grants are present, while anon grants are absent. The lifestyle-details column and validation constraint exist; authenticated insert/update grants are present and anon grants are absent.

Mailbox delivery, a complete real-student sign-in/profile/sign-out/sign-in walkthrough, and a nonempty production Gemini match using stored candidates still require manual verification. A confirmed university mailbox proves control of that mailbox, not current enrollment.

## Schema and migrations

Apply migrations in timestamp order with `npm run supabase:db:push`:

1. `supabase/migrations/20261121180000_restrict_signup_email_domains.sql`
2. `supabase/migrations/20261121200000_roomie_profiles_requests.sql`
3. `supabase/migrations/20261121210000_expand_profile_preferences.sql`
4. `supabase/migrations/20261121220000_profile_photos.sql`
5. `supabase/migrations/20261121230000_profile_lifestyle_details.sql`

The fourth migration adds optional `photo_url` storage and its authenticated column grants. The fifth adds the validated optional `lifestyle_details` JSONB column and authenticated-only write grants. Compatibility fallbacks remain for older local/test schemas.

`public.profiles.id` is both the primary key and a foreign key to `auth.users(id)`, so one account can have at most one profile. Required matching columns are `id`, `university_id`, `display_name`, `budget_min`, `budget_max`, `distance_from_campus_miles`, `move_in_date`, `roommates_wanted`, and `housing_status`. The database stores `have_room` / `need_room`; `rowToProfile` maps those to Person 3's canonical `has_room` / `needs_room` values.

Optional matching columns are `monthly_rent`, `room_type`, `cleanliness`, `sleep_schedule`, `noise_tolerance`, `study_environment`, `guest_frequency`, `pet_preference`, `smoking`, `interests`, `dealbreakers`, and `bio`. `major` and `academic_year` are display-only. `university`, `university_id`, `verified_university_email`, and timestamps are derived or protected and cannot be supplied through normal profile writes.

The canonical matching type is `src/types/profile.ts`. Raw rows and writable fields are in `src/types/database.ts`; `src/lib/profileMapper.ts` is the snake_case-to-matching boundary. A null `move_in_date` is a valid draft but is intentionally rejected by the discovery mapper.

## Authentication and RLS

- Enable Email authentication and email confirmation in Supabase.
- Enable the **Before User Created** hook at `pg-functions://postgres/public/hook_restrict_signup_by_email_domain`.
- Keep `usf.edu` active in `public.university_domains` and `VITE_ALLOWED_EMAIL_DOMAINS=usf.edu` in the frontend. The frontend list is UX only; the hook/database are the security boundary.
- Set the production Site URL to `https://roomie-peach.vercel.app` and allow the exact callback `https://roomie-peach.vercel.app/signup`. Add localhost and exact Codespaces `/signup` callbacks only where needed.
- Production Auth already allows the Vercel callback and has a 500/hour email-send limit. Custom SMTP is enabled, but its configured host (`smtp.rommie.com`) does not resolve and its sender address is a placeholder; replace these with a valid provider host and verified sender before relying on sign-in delivery.

RLS behavior:

- Anonymous users have no profile, request, or university-domain access.
- Confirmed users from an active supported domain may insert/update only their own profile.
- Students cannot write ownership, university, verification, or timestamp columns and have no profile delete policy.
- Confirmed students can read their own profile and active profiles at the same university only.
- Roommate requests are visible only to participants; only the receiver can decide a pending request.
- `api/_lib/supabase.ts` verifies the bearer token with Supabase Auth, then performs profile reads with that same JWT and a fixed safe-column projection. A body-supplied user ID is ignored outside nonproduction demo mode.

Run the hosted transactional policy test in the Supabase SQL editor when policies change:

```sql
-- Paste and execute the complete file. It rolls back all synthetic fixtures.
-- supabase/tests/roomie_rls.sql
```

Do not test RLS with a secret/service-role key because it bypasses RLS.

## Profile creation and editing

After a magic-link callback, `AuthProvider` verifies the session and confirmed user, checks for a profile, and routes a missing profile to `/onboarding`. Onboarding calls the authenticated `upsertMyProfile` path. `/profile` retrieves the stored row with `getMyProfile`, pre-populates every matching field, validates through `profileInputSchema`, and saves through `upsertMyProfile`. Repeated saves update the same primary-key row; concurrent first saves retry safely after a duplicate-key race.

The browser services are:

- `src/lib/profiles.ts`: `getMyProfile`, `upsertMyProfile`, `listProfiles`, `getProfileById`
- `src/lib/profileValidation.ts`: writable input validation and protected-field rejection
- `src/lib/dataAccess.ts`: authenticated context and safe errors
- `src/pages/ProfileEditor.tsx`: persisted editing UI

## Safe fictional test profiles

`npm run seed:demo-profiles` creates 12 clearly fictional profiles and non-login fixture Auth users. It is intentionally gated and must be used only with a separate nonproduction Supabase project. It never runs as an HTTP endpoint and never attaches a fixture to an existing real user.

Create ignored `.env.demo.local`:

```dotenv
SUPABASE_URL=https://YOUR_DEMO_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_DEMO_PROJECT_SECRET_KEY
ROOMIE_DEMO_SEED_PROJECT_REF=YOUR_DEMO_PROJECT_REF
ROOMIE_ALLOW_DEMO_SEED=true
```

Then apply the migrations to that demo project and run:

```bash
npm run seed:demo-profiles
```

The script verifies that the URL's project ref exactly matches the acknowledged ref, refuses a production Vercel environment, uses reserved `@roomie-demo.invalid` addresses, and is repeatable. It adds that synthetic domain with university ID `usf` only inside the demo project so a dedicated confirmed USF test account can see the fixtures. Never add this domain to production.

## Testing authenticated Gemini matching

1. Configure the browser-safe variables and server-only Gemini variables below.
2. Sign in with a dedicated confirmed test account from an allowed domain.
3. Complete `/onboarding` with an active profile and move-in date.
4. Open `/discover` and choose **Find My AI Matches**.
5. The browser sends only its bearer token and filters to `POST /api/match`.
6. The function verifies the token, loads the requester and same-university active candidates through RLS, applies deterministic filters, then calls Gemini.
7. Confirm response cards refer to database fixture IDs and contain no email or secret fields.

Useful checks:

```bash
npm test
npm run lint
npm run build
npx supabase migration list --remote
```

Person 3 does not need a schema or API change. The important contract is that stored `housing_status` remains `have_room` / `need_room`, while `rowToProfile` produces `has_room` / `needs_room` for matching.

## Vercel production configuration

Required Production variables for the current code:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_ALLOWED_EMAIL_DOMAINS=usf.edu
GEMINI_API_KEY=YOUR_SERVER_ONLY_GEMINI_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
ROOMIE_DEMO_MODE=false
```

Only the three `VITE_` values are browser-visible. `GEMINI_API_KEY` must remain server-only. The production matching adapter does not require `SUPABASE_SECRET_KEY` or `SUPABASE_JWKS_URL`; the secret key is needed only by the explicitly invoked nonproduction seed script. Redeploy after changing any `VITE_` variable because Vite embeds it at build time.

The production alias was Ready when inspected on 2026-11-21, but that deployment was created before the latest `main` profile-service merges. Confirm the deployed Git commit after this branch is reviewed and merged; do not assume the current alias contains these changes.

## Roomie AI Insights Edge Function

`supabase/functions/roommate-insights/index.ts` requires a signed-in user JWT (`verify_jwt = true` in `supabase/config.toml`). Its browser request body accepts **only** `{ "targetProfileId": "<uuid>" }`. The function uses the caller's RLS-scoped Supabase client to load the requester and target profile, so the browser never provides descriptions or controls a user ID. It sends a minimized payload without emails, IDs, names, photos, or university fields to Gemini and validates the structured response before returning it.

Configure these Supabase Edge Function secrets (not Vite/Vercel browser variables):

```bash
supabase secrets set GEMINI_API_KEY='replace-with-server-only-key'
supabase secrets set GEMINI_MODEL='gemini-3.5-flash-lite'
supabase secrets set ROOMIE_ALLOWED_ORIGINS='http://localhost:5173,https://roomie-peach.vercel.app,https://roomie-*.vercel.app'
npm run supabase:deploy
```

Use a model identifier available to the project; `GEMINI_MODEL` is never sent by the browser. The function uses the official `@google/genai` SDK's Interactions API with JSON schema output, an in-memory per-instance limit of 5 requests/minute per user, and a 20-second timeout. Its only fallback is a clearly labelled **AI unavailable** error; it never represents static text as Gemini output.

The Edge Function accepts the exact configured origins plus the narrowly scoped `https://roomie-*.vercel.app` preview hostname pattern. It still requires a user JWT; CORS is not an authorization boundary.

Safe authenticated test request (replace placeholders locally; do not paste a token into source control or chat):

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/roommate-insights" \
  -H "apikey: YOUR_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer YOUR_SIGNED_IN_USER_JWT" \
  -H "Content-Type: application/json" \
  --data '{"targetProfileId":"TARGET_PROFILE_UUID"}'
```

Example successful body:

```json
{
  "source": "gemini",
  "model": "gemini-3.5-flash-lite",
  "insights": {
    "summary": "Their budget ranges may overlap. Their schedules could be useful to discuss before making plans.",
    "strengths": ["Their move-in timing may align.", "They may share a preference for a quiet home."],
    "potential_conflicts": ["Guest frequency may be worth discussing."],
    "conversation_starters": ["How do you prefer to divide chores?", "What does a quiet evening look like to you?", "How often do you expect overnight guests?"]
  }
}
```

## Known limitations

- Live email delivery and real mailbox confirmation were not exercised in this change.
- No production data or Vercel/Supabase settings were modified.
- The production deployment has not been updated by this branch.
- The seed command was not run because no separate demo project was supplied.
- Automated tests mock Supabase; policy behavior relies on the SQL smoke test and must be rerun against the intended hosted project after policy changes.
- Profiles intentionally store no email, phone number, exact address, or claimed enrollment status.
