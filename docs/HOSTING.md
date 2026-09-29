# Hosting Docya on Supabase

Docya's backend is one Supabase project: sign-in (Auth), the database with its security rules, and one
account-deletion function. This is the checklist for putting it online. Nothing here needs a server of
your own.

> **Before you start:** the migrations in `supabase/migrations` are written for a database that only
> holds Docya data. Some of them **delete data** (for example the doctor-only migration removes patient
> accounts and drops columns). Apply them to a brand-new project, or to one whose contents you are happy
> to lose. Check with `supabase migration list` first.

## 1. Create the project

1. In the Supabase dashboard create a project (pick the region closest to your doctors) and save the
   database password somewhere safe.
2. Note the **project ref** (the part of the URL: `https://<ref>.supabase.co`).

## 2. Apply the database

```bash
supabase login
supabase link --project-ref <ref>      # asks for the database password
supabase migration list                # local vs. remote: for a new project remote is empty
supabase db push                       # applies every migration in order
```

Do **not** run `supabase/seed.sql` on a hosted project: it creates test doctors with a known password.

## 3. Configure sign-in (Dashboard > Authentication)

- **Providers > Email**: enabled. Turn **Confirm email** ON. Minimum password length 6 (or more; the app
  accepts anything the server accepts).
- **Emails > Templates**: the app asks people to type a 6-digit code instead of clicking a link, so the
  two templates must show `{{ .Token }}`. Paste these (subject and body) over the defaults:
  - *Confirm signup*: subject `Your Docya confirmation code`, body from `supabase/templates/confirmation.html`
  - *Reset password*: subject `Your Docya password reset code`, body from `supabase/templates/recovery.html`
- **URL Configuration**: the Site URL is never opened by the app; set it to your privacy-policy site so
  the field is not blank.
- **Emails > SMTP Settings**: **set up your own SMTP provider before real users sign up.** Supabase's
  built-in mail sender is for testing only: a handful of emails per hour, and only to your own team's
  addresses. Use any transactional provider (Resend, Postmark, SendGrid, Amazon SES...), then check
  **Authentication > Rate Limits** for how many emails per hour you want to allow.
- Leave **anonymous sign-ins** off.

## 4. Point a release build at it

1. Dashboard > Project Settings > API: copy the **Project URL** and the **anon / publishable** key.
   Never use the `service_role` / secret key in the app.
2. Create `.env.production` (git-ignored) in the project root:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=<anon key>
   ```
3. Release bundles (Xcode "Release" configuration, `NODE_ENV=production`) read `.env.production`;
   `npm start` and Debug builds keep reading `.env` (the local stack). A release build that points at a
   local address refuses to start.
4. Restart Metro with `--reset-cache` when you change either file.

## 5. Smoke test on the hosted project

Use a real address you can read:

1. Create an account: the app shows the code screen; the email arrives; the code signs you in.
2. Sign out, choose **Forgot password?**, request a code, set a new password, sign in with it.
3. Set working hours, schedule a patient, cancel it.
4. Profile > Delete account, then confirm the account can no longer sign in.
5. In the dashboard, check **Table Editor**: the doctor's rows and appointments are gone.

## 6. Keep it safe

- The anon key is public by design; the security rules (row-level security) are what protect the data.
  Every table has them enabled, and `npm run backend:check` proves them against a local copy.
- Turn on **Database > Backups** (paid plans have daily backups) and decide who gets dashboard access.
- Anyone can register as a doctor. If that should not be open, add a step before opening the app to the
  public (for example disable sign-ups in Authentication > Sign In / Providers and invite doctors).
- Changing a migration after it is applied: add a new migration, never edit an old one.
