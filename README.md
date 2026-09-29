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

Prerequisites: Node, Xcode, CocoaPods, Docker, the [Supabase CLI](https://supabase.com/docs/guides/cli), and [Maestro](https://maestro.mobile.dev) for E2E.

```bash
npm install
cd ios && LANG=en_US.UTF-8 pod install && cd ..

supabase start                # applies supabase/migrations and supabase/seed.sql
cp .env.example .env          # then paste the API URL and anon/publishable key from `supabase status`
npm start -- --reset-cache    # restart Metro whenever .env changes
npm run ios
```

Seed accounts (local only, password `Password123!`): doctors `maria.santos@`, `juan.delacruz@`, `angela.reyes@doctora.test`.

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
npm run backend:check    # API checks against the local Supabase (wipes local appointments)
npm run e2e              # all Maestro flows on the booted iOS simulator (needs Metro + Debug build)
```

Every pull request runs the type check, lint and unit tests, and starts a throwaway local Supabase to run `backend:check` (see `.github/workflows/ci.yml`). The E2E flows are not in CI: they need a macOS runner with an iOS simulator, so run `npm run e2e` yourself before merging UI changes.

E2E flows: sign in/out, schedule a patient and cancel, slot availability, calendar navigation, register and delete account. `npm run e2e` refuses to run unless `.env` points at a local Supabase.

## Known limitations

- Production needs a hosted Supabase project with custom SMTP and the two email templates (docs/HOSTING.md).
- Anyone can register as a doctor; there is no verification step. Sign-up and password reset use a 6-digit code sent by email.
- Patients get no notification or copy of their appointment; the doctor tells them. Reminders are for the doctor only and live on one phone (a second phone would plan its own once the app is opened there).
- Times are shown in the doctor's time zone.
- Android is not supported; no CI yet.

## License

Created for the ShiftCare technical challenge.
