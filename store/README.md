# App Store screenshots

`store/screenshots/iphone-6.9/` holds the five iPhone screenshots for App Store Connect
(1320 x 2868 pixels, the 6.9" display size; no transparency). The patients in them are invented.

| File | Screen |
|---|---|
| `01-dashboard.png` | Dashboard: today and upcoming, next appointment |
| `02-new-appointment.png` | New appointment: patient, calendar, open and booked slots |
| `03-appointments.png` | Appointments list |
| `04-working-hours.png` | Schedule: weekly working hours |
| `05-reminders.png` | Profile: Reminders card |

Upload them in this order. App Store Connect scales them for smaller iPhones.

## Retaking them (after the UI changes)

1. Boot an **iPhone 17 Pro Max** (or 16 Pro Max) simulator and shut the others down. Make the status bar tidy:
   `xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiBars 3`
2. Install a Debug build and start Metro (`npm start`). Point `.env` at the local Supabase (`supabase start`, `supabase db reset`).
3. `node store/demo-data.mjs` fills the local database with invented appointments for the seeded doctor
   Maria Santos and puts her in a time zone where it is mid-morning (`America/New_York`; change `ZONE` in
   the script if you shoot at another time of day).
4. `maestro test store/capture-warmup.yaml` once (answers iOS's notification prompt), then
   `maestro test store/capture-screenshots.yaml`.
5. Copy the `0*.png` files from the newest folder in `~/.maestro/tests/` into `store/screenshots/iphone-6.9/`.
6. Clear the status bar override afterwards: `xcrun simctl status_bar booted clear`.

Never use real patient names or real accounts, and do not run this against the hosted project.
