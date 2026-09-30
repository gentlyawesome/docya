# Docya - Appointment Book for Doctors

An iOS-first React Native app for doctors to manage their appointments. A doctor signs up, sets weekly working hours, and books patients into open 30-minute slots. Patients are not users: the doctor types in the patient's name (and optionally a phone number). Backed by Supabase (Auth, Postgres with row-level security).

## Features

- Email/password accounts for doctors, with in-app account deletion
- Weekly working-hours editor and a small profile (name, phone, specialization, time zone)
- **New appointment**: enter the patient's name and phone, pick a day on the calendar and an open slot, confirm. Booked slots are marked and cannot be double-booked
- Appointment list (Upcoming / Past), dashboard with today's and upcoming counts, cancel, mark completed, private notes
- **Reminders**: a notification 15, 30 or 60 minutes before each upcoming appointment (default 30), set on the Profile tab. They are local to the phone; patient names stay off the lock screen unless switched on. Scheduled when appointments are loaded or created, cancelled when an appointment is cancelled or the doctor signs out; at most 60 are pending at once (iOS allows 64).

## Tech stack

React Native 0.84 (bare, TypeScript) · Redux Toolkit (auth only) · React Navigation 7 · Supabase (`@supabase/supabase-js`) · AsyncStorage (session) · date-fns / date-fns-tz · Jest + React Native Testing Library · Maestro (E2E)

## Getting started

Prerequisites: Node, Xcode, CocoaPods, the [Supabase CLI](https://supabase.com/docs/guides/cli) (logged in with `supabase login`), and [Maestro](https://maestro.mobile.dev) for E2E. **No Docker needed.**

```bash
npm install
cd ios && LANG=en_US.UTF-8 pod install && cd ..

cp .env.example .env          # then fill in the URL and anon key of the Docya Dev project (see below)
supabase link --project-ref <dev project ref>
npm start -- --reset-cache    # restart Metro whenever .env changes
npm run ios
```

### Two hosted projects, no Docker

| Project | Used by | Settings file |
|---|---|---|
| **Docya Dev** (`fhmtibdtvlpiculqkqco`) | development, the simulator, `backend:check`, `e2e`, the demo data | `.env` |
| **Docya** (production, ref in `supabase/production-ref`) | Release builds, TestFlight, App Store | `.env.production` |

The scripts that create or delete data (`backend:check`, `e2e`, `dev:reset`, `store/demo-data.mjs`) read `.env`, and **refuse to run if it points at the production project** or if the CLI is linked to a different project than `.env`.

`npm run dev:reset` wipes the dev project, re-applies every migration and loads the sample doctors (`maria.santos@`, `juan.delacruz@`, `angela.reyes@doctora.test`, password `Password123!`; dev project only). To create your own dev project: make a free project in the Supabase dashboard, put its URL and anon key in `.env`, run `supabase link --project-ref <ref>`, then `npm run dev:reset`. On the dev project, turn **Confirm email** off (Authentication > Sign In / Providers > Email) so test accounts can sign in without an emailed code.

Docker is optional now: `supabase start` still gives a full local copy with a mail catcher (`.env` pointing at `http://127.0.0.1:54321`), which is the only place the emailed-code checks run on your machine. GitHub's CI uses its own throwaway copy, so those checks run on every pull request anyway.

## Going online

See [docs/HOSTING.md](docs/HOSTING.md) for putting the backend on a hosted Supabase project, the email templates and SMTP it needs, and how release builds pick up `.env.production`.

## Project layout

```
src/
  config/supabase.ts      Supabase client (session persisted in AsyncStorage)
  services/               authService, userService, appointmentsService, availabilityService, mappers
  store/slices/           auth
  screens/                auth/, profile/, doctor/ (dashboard, appointments, new appointment, schedule)
  navigation/AppNavigator Loading -> Auth stack | Doctor tabs
supabase/
  migrations/             schema, RLS policies, grants, delete_my_account
  seed.sql                3 doctors (local development only)
  tests/backend-check.mjs API-level checks of the security rules
e2e/                      Maestro flows + run.mjs (resets the local DB per flow)
```

## Data and security model

- Everyone who registers is a doctor. Row-level security: a doctor sees and changes only their own profile, working hours and appointments.
- An appointment stores the patient's name and phone as plain text typed by the doctor. Patients have no accounts and no access. The doctor is responsible for having the right to keep that information (see the privacy policy).
- Appointments are created confirmed and can only be cancelled or completed afterwards; date, time and patient cannot be edited. A unique index prevents double-booking on the server.
- `delete_my_account()` removes the doctor's account, working hours and appointments.
- The `anon` key in `.env` is public by design; access is enforced by RLS. `.env` is git-ignored.

## Testing

```bash
npm run typecheck && npm run lint
npm test                 # unit tests (Supabase mocked at the client boundary)
npm run backend:check    # API security checks against the dev project (deletes its appointments)
npm run e2e              # all Maestro flows on the booted iOS simulator (needs Metro + Debug build)
npm run dev:reset        # clean slate for the dev project
```

Every pull request runs the type check, lint and unit tests, and starts a throwaway Supabase (in GitHub's cloud, not on your machine) to run `backend:check` (see `.github/workflows/ci.yml`). The E2E flows are not in CI: they need a macOS runner with an iOS simulator, so run `npm run e2e` yourself before merging UI changes.

E2E flows: sign in/out, schedule a patient and cancel, slot availability, calendar navigation, register and delete account. `npm run e2e` refuses to run unless `.env` points at a local Supabase.

## Known limitations

- Production needs a hosted Supabase project with custom SMTP and the two email templates (docs/HOSTING.md).
- Anyone can register as a doctor; there is no verification step. Sign-up and password reset use a 6-digit code sent by email.
- Patients get no notification or copy of their appointment; the doctor tells them. Reminders are for the doctor only and live on one phone (a second phone would plan its own once the app is opened there).
- Times are shown in the doctor's time zone.
- Android is not supported; no CI yet.

## License

Created for the ShiftCare technical challenge.
