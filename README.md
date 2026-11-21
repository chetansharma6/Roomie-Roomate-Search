# Roomie-Roomate-Search

Roomie is a student-focused room and roommate discovery project. It is designed to help students find compatible housing partners by combining rental preferences, move-in timing, campus distance, and lifestyle preferences.

## Project Status

The repository contains a React, TypeScript, and Vite application with passwordless Supabase authentication, fictional demo discovery, deterministic compatibility scoring, Gemini-assisted matching through a Vercel Function, and an authenticated Supabase Edge Function for Gemini-powered roommate conversation insights. Live profile persistence and database migrations are still pending.

## Problem

Finding off-campus housing is difficult. Finding people who fit a shared budget, move-in schedule, location, and everyday routine can be harder.

Students commonly use group chats, social media, and general listing sites. Those channels split housing needs and roommate preferences across separate conversations and make it difficult to compare matches consistently.

## Product Goals

Roomie will support two housing situations:

1. A student needs a place and wants to find people to house-hunt with or join an available room.
2. A student has a room and wants to find a compatible person to fill it.

The first release should prioritize reliable discovery and filtering over features that are difficult to complete or maintain.

## Planned Features

### Student Profiles

Profiles can include:

- A short introduction
- School and optional major
- Budget range
- Preferred move-in date and lease length
- Housing status
- Desired roommate count
- Preferred campus or neighborhood
- Bedroom and furnishing preferences
- Cleanliness, noise, sleep, study, guest, and pet preferences
- Interests and transportation preferences

### Discovery

Discovery should allow users to filter profiles or listings by:

- Maximum monthly rent
- Campus distance
- Move-in date
- Desired roommate count
- Housing status

The filters should distinguish hard requirements from optional preferences. Mandatory constraints should remove incompatible results; lifestyle preferences should rank otherwise eligible results.

### Compatibility

A score can provide a starting point for comparison, not a prediction of whether two people will get along.

An example model is:

compatibility score = 100 x (
  0.30 x budget fit +
  0.25 x lifestyle fit +
  0.20 x move-in fit +
  0.15 x campus distance fit +
  0.10 x roommate-count fit
)

Each fit value should range from 0 to 1. Results should explain the factors behind a score in plain language and avoid implying that the score measures trust, safety, or roommate success.

### Optional Connections

The next useful connection feature is a simple interest request flow:

- One student sends a request to another student.
- The recipient can accept or decline.
- Duplicate requests are prevented.
- Users can only create or modify requests for their own account.

In-app messaging should wait until mutual interest exists.

## Stack

The implemented stack is:

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui or equivalent accessible primitives |
| Authentication | Supabase Auth |
| AI orchestration | Vercel Functions, Supabase Edge Functions, and Gemini API |
| Database | Supabase and PostgreSQL |
| Matching logic | TypeScript |
| Hosting | Vercel |

Additional services should be added only when a concrete feature requires them.

## Initial Setup

Install dependencies, copy the environment template, and add the Supabase project values:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Available scripts are:

```bash
npm run dev
npm run dev:vercel
npm run build
npm run lint
npm run preview
npm run typecheck
npm test
npm run smoke:gemini
npm run supabase:serve
npm run supabase:deploy
npm run supabase:db:push
```

## Environment Variables

Supabase requires client configuration when persistence and authentication are implemented.

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
VITE_ALLOWED_EMAIL_DOMAINS=usf.edu
```

Never commit a Supabase service-role key, secret key, or real student data. Vite variables prefixed with `VITE_` are exposed to browser code.

Keep local browser and Vercel Function values in `.env.local`, which is ignored by Git. Only the project URL and publishable key belong in `VITE_` variables. Server-only secrets must never use that prefix or be imported by code under `src/`.

`VITE_ALLOWED_EMAIL_DOMAINS` is a comma-separated UX allowlist. It fails closed when empty, but browser validation is not a security boundary. The database migration in `supabase/migrations/` enforces the same policy through a Supabase **Before User Created** hook. Add a domain explicitly in both places before supporting another university; a generic `.edu` suffix is intentionally not accepted.

## Supabase Authentication Setup

The application uses `signInWithOtp()` with a magic-link redirect to `/signup` on the current origin. Configure the hosted Supabase project before testing:

1. Under **Authentication → Sign In / Providers → Email**, enable email authentication and keep email confirmation enabled.
2. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173` for local development. Add `http://localhost:5173/signup` and the deployed Vercel `/signup` URL to the allowed redirect URLs before deployment.
3. Keep the default magic-link email template. If the UI is later changed to accept a six-digit code, update the appropriate template to display `{{ .Token }}` and add an OTP verification form.
4. Apply the migrations with `npm run supabase:db:push`.
5. Under **Authentication → Hooks**, enable **Before User Created**, select the Postgres function `public.hook_restrict_signup_by_email_domain`, and test one allowed and one rejected domain.
6. Configure custom SMTP before testing arbitrary student addresses or production traffic. Supabase's built-in sender is intended for initial testing, sends only to project-team addresses, and is limited to two authentication emails per hour per project.

Do not disable email confirmation to work around delivery limits. For a demo without custom SMTP, prepare a legitimately verified account and keep its session available; do not represent an unverified or simulated address as verified.

### Shared authentication service

`src/lib/auth.ts` exports `sendMagicLink(email)`, `getCurrentUser()`, `getSession()`, `signOut()`, and `isSupportedUniversityEmail(email)`. The application is wrapped in `AuthProvider`; screens can call `useAuth()` from `src/hooks/useAuth.ts` for `user`, `session`, `loading`, `error`, `destination`, `sendMagicLink`, `signOut`, and `refresh`. Call `refresh()` after creating a profile. Session restoration verifies identity through Supabase Auth before checking profile existence. New users go to `/onboarding`; existing profiles go to `/discover`. `/account` provides sign-out and conversation insights.

Signed-in students can open `/profile` to retrieve and edit their persisted matching profile. Fictional database candidates can be created only in a dedicated nonproduction project with `npm run seed:demo-profiles`; see `PERSON2_SUPABASE_HANDOFF.md` for the gated setup.

Run `npm test -- tests/auth.test.ts` for the authentication service tests. One test normalizes `Student@USF.EDU`, confirms that `signInWithOtp` receives the `/signup` callback, and checks that invalid or unsupported emails never reach Supabase. The suite also checks expired sessions/links, rate limits, confirmation, profile routing, and sign-out. These are automated tests with mocked Supabase responses.

For a real mailbox test: run `npm run dev`, open `/signup`, enter a supported university address, follow the received link, and confirm a new account reaches `/onboarding`. Save a profile and verify `/discover`, reload to test restoration, then sign out through `/account`. Sign in again and confirm direct routing to `/discover`. Test an expired link and an unsupported email separately. Keep tokens out of logs and screenshots; real student mailbox verification remains pending until this walkthrough succeeds.

If delivery fails for non-team addresses, configure **Authentication → Email → SMTP Settings** with your provider's host, port, username, password, verified sender address, and sender name. Use the provider's recommended TLS settings and disable link tracking if it rewrites magic links. Store SMTP credentials in Supabase settings, then retry a supported mailbox; email confirmation must remain enabled.

The `roommate-insights` Edge Function requires two server-only secrets:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Set production values in Supabase under **Edge Functions → Secrets**, or with the Supabase CLI:

```bash
supabase secrets set --env-file path/to/ignored-gemini.env
npm run supabase:deploy
```

For local Edge Function development, copy `supabase/functions/.env.example` to the ignored `supabase/functions/.env`. The existing `/api/match` Vercel Function reads the same two Gemini variables from the ignored root `.env.local`; configure them in Vercel project settings if that function is deployed. Never prefix the Gemini key with `VITE_`, return it in an HTTP response, or write it to logs.

## Profile and roommate-request data access

Import profiles from `src/lib/profiles.ts` and requests from `src/lib/roommateRequests.ts`. Both use the existing Supabase browser SDK and confirmed Auth identity. Database RLS remains the authorization boundary. `ProfileRow` and `RoommateRequestRow` reuse `src/types/database.ts`; convert complete profiles with `rowToProfile` when passing them to Person 3's matching UI.

| Function | Parameters | Resolved value |
| --- | --- | --- |
| `getMyProfile()` | None | `ProfileRow` or `null` when missing; includes the owner's inactive/draft profile |
| `upsertMyProfile(input)` | `ProfileInput`: complete writable snake_case profile data | Saved `ProfileRow`; owner ID comes from Auth |
| `listProfiles()` | None | `ProfileRow[]`: first 500 authorized active profiles, excluding the current user |
| `getProfileById(id)` | Profile UUID | `ProfileRow` or `null` for missing/RLS-hidden rows |
| `sendRoommateRequest(receiverId)` | Receiver UUID | Created pending `RoommateRequestRow` |
| `getMyRoommateRequests()` | None | `{ sent: RoommateRequestRow[], received: RoommateRequestRow[] }`, newest first |
| `respondToRoommateRequest(requestId, status)` | Request UUID and `'accepted'` or `'declined'` | Updated `RoommateRequestRow` |

All functions return Promises and reject with `DataAccessError` from `src/lib/dataAccess.ts`. Its stable `code` is `unauthenticated`, `validation`, `forbidden`, `duplicate`, `not_found`, `network`, or `database`; its message is safe for display. Treat missing/RLS-hidden profiles as `null`, empty lists as `[]`, and a zero-row request response as `not_found` (unavailable or already answered). Loading belongs in the consuming component; `src/examples/useMyProfileExample.ts` shows loading, empty and error states with unmount protection.

`ProfileInput` requires `display_name`, integer budgets (0–100,000, minimum <= maximum), `distance_from_campus_miles` (0–1,000), `roommates_wanted` (integer 1–20), and `housing_status` (`have_room` or `need_room`). Bio is capped at 2,000 characters; display names at 100. Preference enums follow the existing matching types. Omitted optional fields reset to null/empty defaults, and `is_active` defaults to true: this is a complete-profile save, not a partial patch. IDs, university, verification and timestamps are rejected as input. A nullable move-in date supports drafts, which the existing matching mapper skips.

```ts
import { getMyProfile, listProfiles, upsertMyProfile } from './lib/profiles'
import { sendRoommateRequest, getMyRoommateRequests, respondToRoommateRequest } from './lib/roommateRequests'
import { DataAccessError } from './lib/dataAccess'

// After useAuth() has restored the signed-in student:
try {
  const saved = await upsertMyProfile({
    display_name: 'Alex', budget_min: 600, budget_max: 950,
    distance_from_campus_miles: 3, roommates_wanted: 2,
    housing_status: 'need_room', move_in_date: '2027-08-01',
  })
  const mine = await getMyProfile()
  const candidates = await listProfiles()
  if (candidates[0]) await sendRoommateRequest(candidates[0].id)
  const { received } = await getMyRoommateRequests()
  const pending = received.find((request) => request.status === 'pending')
  if (pending) await respondToRoommateRequest(pending.id, 'accepted')
  // Call useAuth().refresh() after first profile creation to refresh route state.
} catch (error) {
  const message = error instanceof DataAccessError ? error.message : 'Please retry.'
  // Display message in the component; reset its loading flag in finally.
}
```

The existing `createProfile(userId, profile)` helper delegates to the new authenticated service for compatibility; its legacy userId argument is ignored. No teammate UI components were rewritten. Sending a repeated request in either direction is a `duplicate` error, even after acceptance/decline; receivers may decide only once. The database enforces those rules atomically.

Run `npm test -- tests/profileDataAccess.test.ts tests/profilePersistence.test.ts` for mocked SDK tests. For real-session testing, use two confirmed supported-university accounts: save each own profile; verify A cannot edit B or set verification; deactivate B and confirm A's list excludes B; send A→B; ensure repeats/reverse/self requests fail; confirm only B can respond; confirm an unrelated account cannot see either party's request. The hosted database checklist is in `supabase/DATABASE_SETUP.txt`. Mocked tests do not prove a real mailbox flow.

## Hosting

Use one Vercel project for the Vite frontend and the Node.js `/api/match` function. Supabase continues to provide PostgreSQL, Auth, and the `roommate-insights` Edge Function. A separate Render server is unnecessary for this architecture.

Production: https://roomie-peach.vercel.app. The Vercel project is `team-roomie/roomie`; production environment variables are configured, and Supabase allows `https://roomie-peach.vercel.app/signup` alongside localhost. Deploy an updated main branch with `npx vercel deploy --prod --yes` after logging into the project. GitHub-triggered deployments additionally require a successful repository connection in Vercel.

The checked-in `vercel.json` builds with `npm run build`, serves `dist`, and rewrites the application routes to the SPA without rewriting `/api/match`. `.vercelignore` excludes local environment files from uploaded source.

Configure these Vercel environment variables for Production (and Preview if needed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ALLOWED_EMAIL_DOMAINS=usf.edu`, server-only `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash-lite`, and `ROOMIE_DEMO_MODE=false`. Matching uses the student's JWT and does not require the Supabase secret key. Redeploy after changing browser variables because Vite embeds them at build time.

Once a production URL is assigned, set Supabase's Site URL to that HTTPS origin and allow its exact `/signup` URL alongside the localhost callback. Keep email confirmation and the domain hook enabled. Real student sign-in still requires working SMTP and mailbox confirmation; deployment alone does not validate that flow.

## AI Roommate Insights

Signed-in users can submit a short description of their housing and everyday living preferences. The browser sends it to the authenticated `roommate-insights` Edge Function, which validates the user and input before contacting Gemini. The function returns conversation prompts and practical considerations; it does not make housing eligibility, trust, safety, or guaranteed-compatibility decisions.

Users should not submit names, contact details, exact addresses, or other sensitive personal information. AI output can be incomplete and should be independently verified.

## Project Structure

Key directories are:

```text
roomie/
  api/
    match.ts
  src/
    components/
    pages/
    lib/
      supabase.ts
    App.tsx
    main.tsx
    styles.css
  supabase/
    functions/
      roommate-insights/
        index.ts
    config.toml
  .env.example
  package.json
  README.md
```

The application provides passwordless email authentication, a fictional discovery demo with deterministic and Gemini-assisted ranking, and authenticated AI conversation insights. Profile persistence must be completed before signed-in discovery can use live student records.

## Planned Data Model

### Profiles

| Field | Example | Purpose |
| --- | --- | --- |
| id | UUID | Authenticated user identifier |
| display_name | Alex | Public display name |
| university | Example University | School name |
| bio | Quiet, tidy, and independent | Public introduction |
| budget_min | 650 | Minimum preferred monthly rent |
| budget_max | 900 | Maximum preferred monthly rent |
| distance_max_miles | 3 | Preferred campus distance |
| move_in_date | 2027-08-01 | Intended move-in date |
| roommates_wanted | 2 | Desired roommate count |
| housing_status | need_room or have_room | Current housing situation |
| cleanliness | tidy | Lifestyle preference |
| sleep_schedule | night | Lifestyle preference |
| pets_preference | no_pets | Lifestyle preference |
| verified_university_email | true | Server-derived verification status |
| created_at | Timestamp | Record creation time |

Room listings should use a separate table or clearly distinguish asking rent and actual listing distance from profile preferences.

### Interest_Requests

| Field | Purpose |
| --- | --- |
| id | Request identifier |
| sender_id | Student sending the request |
| recipient_id | Student receiving the request |
| status | pending, accepted, or declined |
| created_at | Request creation timestamp |

The database should enforce one request per sender and recipient pair, prevent self-requests, and restrict request changes to authorized users.

## Responsive Experience

The application should use a responsive layout rather than separate desktop and mobile implementations.

Desktop expectations:

- Accessible navigation, search, and filters
- A multi-column result layout
- Side-by-side profile details where useful

Mobile expectations:

- A one-column result layout
- Touch-friendly controls
- Compact filter access
- Navigation that remains usable at narrow widths

## Verification and Safety

Verification and moderation should be described accurately:

- University email confirmation proves control of an email mailbox. It does not necessarily prove current enrollment.
- Supported university domains should be maintained explicitly rather than inferred from arbitrary `.edu` suffixes.
- Domain checks and profile authorization should include server-side enforcement where real accounts are used.
- Public badges should say "University email verified" unless independent enrollment verification is implemented.
- Public profiles should not expose full email addresses or exact private locations.
- The database should use Row Level Security and authorization policies.
- Reporting, blocking, and privacy controls should be added before open public use.
- Housing features should consider applicable fair-housing and privacy requirements.

Roomie should not replace meeting a prospective roommate, reviewing a lease, or independently verifying a property.

## Implementation Plan

The proposed delivery sequence is:

1. Scaffold the React and TypeScript application. (Complete)
2. Define the shared profile and listing types. (Profile types complete; listings pending)
3. Add a landing page and responsive navigation. (Initial experience complete)
4. Add profile creation and editing.
5. Add Supabase authentication and database access. (Authentication connected; database access pending)
6. Add fictional demo profiles and discovery filters. (Complete)
7. Add explainable compatibility ranking. (Complete with deterministic fallback and Gemini enhancement)
8. Add an interest request flow if persistence and authorization are stable.
9. Add automated tests and database security checks. (Matching tests complete; database checks pending)
10. Deploy and test the complete browser experience on desktop and mobile.

Gemini-powered roommate conversation insights are implemented through a server-side Supabase Edge Function. They supplement rather than replace the deterministic compatibility model planned above.

Demo data should always be labeled as fictional and must not be presented as real users or listings.

## Contributing

1. Create a focused feature branch.
2. Keep changes limited to one screen or service.
3. Follow the existing format and naming conventions.
4. Run the relevant tests and build before opening a pull request.
5. Never commit private keys, service-role credentials, real student records, or personal information without consent.

## License

A license has not been selected. Add a LICENSE file before publishing the project under an open-source license. Until then, this repository should not be assumed to provide reuse permissions.
