# Docya - Doctor Appointment Booking

An iOS-first React Native app where patients request appointments with doctors and doctors confirm or decline them. Backed by Supabase (Auth, Postgres with row-level security).

## Features

**Patients**
- Browse doctors with specialty, rating and fee; search and filter; favourites
- 14-day calendar with 30-minute slots, shown in the doctor's time zone
- Request an appointment (starts as *Awaiting confirmation*), cancel it, add it to the calendar, and get a local reminder
- Profile tab: personal details, About, privacy policy, sign out, delete account

**Doctors**
- Dashboard, appointment list (Pending / Upcoming / Past), confirm, decline, cancel, mark completed, private notes
- Weekly schedule editor and a profile with clinic, fee and bio

**Both**: email/password accounts, role chosen at sign-up, in-app account deletion.

## Tech stack

React Native 0.84 (bare, TypeScript) · Redux Toolkit · React Navigation 7 · Supabase (`@supabase/supabase-js`) · AsyncStorage (session, cache, favourites, reminders) · Notifee (local reminders) · date-fns / date-fns-tz · zod 3 · Jest + React Native Testing Library · Maestro (E2E)

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

Seed accounts (local only, password `Password123!`): `patient1@doctora.test`, `patient2@doctora.test`, and doctors `maria.santos@`, `juan.delacruz@`, `angela.reyes@doctora.test`.

## Project layout

```
src/
  config/supabase.ts      Supabase client (session persisted in AsyncStorage)
  services/               authService, userService, doctorsService, appointmentsService,
                          availabilityService, mappers (DB rows -> app types), reminders,
                          calendarExport, storage
  store/slices/           auth, doctors, bookings, favorites
  screens/                patient screens; auth/, profile/, doctor/
  navigation/AppNavigator Loading -> Auth stack | Patient tabs | Doctor tabs
supabase/
  migrations/             schema, RLS policies, grants, get_booked_slots, delete_my_account
  seed.sql                3 doctors, 2 patients (local development only)
  tests/backend-check.mjs API-level checks of the security rules
e2e/                      Maestro flows + run.mjs (resets the local DB per flow)
```

## Data and security model

- Row-level security on every table. Patients see only their own appointments; doctors see only appointments with them and the profiles of their own patients.
- Other patients' booked times are exposed only through the `get_booked_slots` function (times, no identities); a unique index prevents double-booking on the server.
- Only doctors can confirm/decline; patients can cancel their own.
- `delete_my_account()` removes the account and its data. Reminders and the session stay on the device.
- The `anon` key in `.env` is public by design; access is enforced by RLS. `.env` is git-ignored.

## Testing

```bash
npx tsc --noEmit && npx eslint src __tests__
npm test                 # unit tests (Supabase mocked at the client boundary)
npm run backend:check    # 24 API checks against the local Supabase (wipes local appointments)
npm run e2e              # all Maestro flows on the booted iOS simulator (needs Metro + Debug build)
```

E2E flows: sign in/out, book and cancel, slot availability, favourites and filters, search, calendar navigation, doctor confirms a patient's request, register and delete account. `npm run e2e` refuses to run unless `.env` points at a local Supabase.

## Known limitations

- Production needs a hosted Supabase project, its keys, and email-confirmation settings configured.
- Anyone can register as a doctor and is listed immediately; there is no verification step.
- Signed-in users can see the email/phone of doctors.
- Reminders are per device and not synced.
- Android is not supported (Notifee build issue); no CI yet.
- Times are shown in the doctor's time zone, not converted to the user's.

## License

Created for the ShiftCare technical challenge.
