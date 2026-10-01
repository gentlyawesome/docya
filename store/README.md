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

**Which folder for which slot:** App Store Connect shows a slot per display size, and each slot accepts only
certain pixel sizes.

| Slot | Accepted sizes | Folder |
|---|---|---|
| iPhone 6.9" Display | 1320 x 2868 (or 1290 x 2796) | `iphone-6.9/` |
| iPhone 6.5" Display | 1284 x 2778 or 1242 x 2688 | `iphone-6.5/` |
| iPad 13" Display | 2064 x 2752 (or 2048 x 2732) | `ipad-13/` |

You need one of the two; the 6.9" set is enough on its own. `iphone-6.5/` is the same five pictures scaled to
1284 x 2778 (12 blank pixels trimmed from the bottom margin), for when only the 6.5" slot is shown. If you
retake the 6.9" pictures, remake the 6.5" ones from them (resize to 1284 wide, crop to 2778 tall, save as RGB).

## Retaking them (after the UI changes)

1. Boot an **iPhone 17 Pro Max** (or 16 Pro Max) simulator and shut the others down. Make the status bar tidy:
   `xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiBars 3`
2. Install a Debug build and start Metro (`npm start`). Point `.env` at the Docya Dev project (`npm run dev:reset` for a clean start).
3. `node store/demo-data.mjs` fills the local database with invented appointments for the seeded doctor
   Maria Santos and puts her in a time zone where it is mid-morning (`America/New_York`; change `ZONE` in
   the script if you shoot at another time of day).
4. `maestro test store/capture-warmup.yaml` once (answers iOS's notification prompt), then
   `maestro test store/capture-screenshots.yaml`.
5. Copy the `0*.png` files from the newest folder in `~/.maestro/tests/` into `store/screenshots/iphone-6.9/`.
6. Clear the status bar override afterwards: `xcrun simctl status_bar booted clear`.

Never use real patient names or real accounts. `demo-data.mjs` refuses the production project.

## iPad set (`ipad-13/`) - only if the app ships with iPad support

The project is universal (`TARGETED_DEVICE_FAMILY = "1,2"`) because Apple rejects an update that drops devices earlier
versions supported (QA1623), so App Store Connect requires these iPad screenshots. They are the same five screens, taken
on an iPad Pro 13" simulator (2064 x 2752), and show the phone layout stretched across the tablet.

To retake them without changing the project: build a temporary iPad-capable copy
`xcodebuild ... -derivedDataPath build-ipad TARGETED_DEVICE_FAMILY="1,2" build`, install it on the iPad simulator,
and run the same two Maestro flows. iPadOS 26 draws a small window-resize handle in the bottom-right corner;
it is not part of the app, so it was painted over with the flat background colour behind it.
