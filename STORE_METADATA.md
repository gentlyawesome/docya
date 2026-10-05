# Docya - App Store Metadata (iPhone and iPad)

Copy these into App Store Connect. Docya ships as a universal iOS build (iPhone and iPad), because Apple does not allow an update to drop devices an earlier version supported. There is no Android version.
Character limits are checked below. Last reviewed: October 4, 2026.

---

## Basic information

**App name** (30 max) - `Docya`

**Subtitle** (30 max) - `Appointment Book for Doctors` (28)

**Promotional text** (170 max, can be changed without a new build)
```
A simple appointment book for doctors. Set your hours, book patients, get reminders, stay organized. Private, ad-free, with in-app account deletion.
```

**Description** (4000 max)
```
Docya is a simple appointment book for doctors.

Set your weekly working hours, then book patients into open 30-minute slots in seconds. See what is coming up today and this week, get a reminder before each visit, cancel or complete visits, and keep private notes on each appointment.

FEATURES:
• Weekly working-hours editor
• Book a patient by name and phone number
• Calendar view with open and booked slots, no double-booking
• Dashboard with today's and upcoming appointments
• Reminders before each appointment (15, 30 or 60 minutes)
• Cancel or complete appointments and add private notes
• Your profile: name, specialization, time zone

PRIVACY FIRST:
Your appointments are visible only to you. No ads, no tracking. Reminders are created on your phone and do not include patient names unless you choose to. Delete your account and all of its data in the app any time.

HOW IT WORKS:
1. Create your doctor account
2. Set your working hours
3. Tap New appointment, enter the patient, pick a day and an open slot
4. Manage your day from the dashboard

For doctors and clinicians. Patients do not need the app.
```

**Keywords** (100 max, comma separated, no spaces) - 87 characters
```
doctor,appointment,booking,medical,health,schedule,calendar,clinic,healthcare,physician
```

**What's New** (version 1.9.3)
```
Bug fixes and improvements.
```


---

## Categories, rating and URLs

| Field | Value |
|---|---|
| Primary category | Medical |
| Secondary category | Productivity |
| Age rating | 4+ (answer the questionnaire honestly: no medical or treatment advice, no user-to-user content) |
| Price | Free |
| Privacy Policy URL | https://gentlyawesome.github.io/docya/privacy-policy.html |
| Support URL | https://gentlyawesome.github.io/docya/ (the page has the contact email) |
| Marketing URL (optional) | https://gentlyawesome.github.io/docya/ |
| Support email | gentlyawesome@gmail.com |
| Copyright | `2026 <your name or company>` |

The privacy policy URL goes into App Store Connect only; nothing needs to be added to `Info.plist`.

---

## App Privacy ("nutrition label") - suggested answers, please review

Docya has a server (Supabase), so it does collect data. Apple wants every type below listed, all **linked to the user's identity** and **not used for tracking**. Processors that only store data for us (Supabase, our email sender) do not count as "sharing".

| Data type (Apple's wording) | What it is in Docya | Purpose |
|---|---|---|
| Contact Info - Name | Doctor's name; patient names typed into appointments | App Functionality |
| Contact Info - Email Address | Doctor's sign-in email | App Functionality, account management |
| Contact Info - Phone Number | Doctor's optional phone; patient phones typed into appointments | App Functionality |
| Health & Fitness - Health | Appointment notes may contain health information the doctor chooses to write | App Functionality |
| User Content - Other User Content | Appointment notes | App Functionality |
| Identifiers - User ID | Account ID | App Functionality |

Answer **No** to: tracking, advertising, analytics, diagnostics/crash data, location, contacts, purchases, browsing history.

Note: the patient's own details are typed in by the doctor without the patient using the app. The privacy policy makes the doctor responsible for that. Have the wording of both reviewed before submitting.

---

## Compliance answers

- **Encryption**: the app only uses standard HTTPS, which is exempt. `ITSAppUsesNonExemptEncryption` is set to `false` in `Info.plist`, so App Store Connect will not ask for every build.
- **Advertising Identifier (IDFA)**: not used.
- **Account deletion**: available in the app (Profile > Delete account), as App Review requires for apps that create accounts.
- **Sign in with Apple**: not needed; the app has no third-party sign-in.
- **Content rights**: no third-party content.
- **Notifications**: reminders are local notifications, asked for the first time a reminder is scheduled.

---

## Notes for App Review

Put these in the "App Review Information" fields (never in this file):

- **Demo account**: create a dedicated doctor account on the hosted project (with working hours set for the coming weekdays), and enter its email and password in the review fields. Reviewers cannot use a sign-up code sent to a mailbox they cannot read.
- **Notes to reviewer** (suggested text):
```
Docya is an appointment book for doctors. Sign in with the demo account. Tap "New appointment", type any patient name, pick a day and an open time slot and confirm. Reminders can be set in the Profile tab; they are local notifications. Patients do not use the app: the doctor types the patient's name and optional phone number. Account deletion is in Profile > Delete account.
```

---

## Screenshots (iPhone and iPad)

**Done**: five screenshots, no transparency, taken from the app with invented patients and a clean status
bar. `store/screenshots/iphone-6.9/` (1320 x 2868) fits the **6.9" Display** slot; `store/screenshots/iphone-6.5/`
(1284 x 2778, same pictures) fits the **6.5" Display** slot. Use whichever slot App Store Connect shows.

**iPad**: upload `store/screenshots/ipad-13/` (2064 x 2752) as the iPad 13" set. They show the phone layout stretched across the tablet, which is acceptable for review; an iPad layout is future work.

Upload in this order, with these captions if you add text overlays (plain screenshots are also fine):

1. `01-dashboard.png` - **Your Day at a Glance**: today's and upcoming appointments
2. `02-new-appointment.png` - **Book in Seconds**: enter the patient, pick a day and an open slot
3. `03-appointments.png` - **Every Visit in One Place**: upcoming appointments, cancel or complete
4. `04-working-hours.png` - **Your Hours, Your Rules**: set the weekly schedule
5. `05-reminders.png` - **Never Miss a Visit**: reminders 15, 30 or 60 minutes before

They were taken from a Debug build against a local test database. Nothing in them differs from a Release
build, but if the interface changes, retake them.

---

## App icon

Source: the 1024 x 1024 artwork in `ios/DoctoraAppointments/Images.xcassets/AppIcon.appiconset/icon-1024.png` (no transparency, as App Store Connect requires; Xcode builds every smaller size from it). It is a rounded tile on a white square, so on the home screen it shows a thin white border; a full-bleed version of the artwork would look better.

---

## Before submission

### Ready
- [x] App name, subtitle, description, keywords, promotional text
- [x] Privacy policy written and published (GitHub Pages, built from `develop` /docs)
- [x] App icon in the app (1024 x 1024, no alpha)
- [x] Display name "Docya", iPhone and iPad, encryption flag set
- [x] Account deletion in the app; reminders permission asked in context

### Still to do
- [x] Bundle ID `org.reactjs.native.example.Docya` (matches the App Store Connect app; it still has the template prefix `org.reactjs.native.example`, so move to your own domain, for example `com.yourname.docya`, only if you create a new app record). Version 1.9.3, build 15 (an approved version is closed to new builds, so every upload needs a higher version); raise the build number for every upload
- [ ] Hosted Supabase: connect an email provider (SMTP), turn on the sign-up code and the two email templates (`docs/HOSTING.md`)
- [ ] Decide who may register as a doctor (open sign-up today)
- [ ] Legal review of the privacy policy
- [ ] Demo account for App Review
- [x] Screenshots (5, 6.9", in `store/screenshots/iphone-6.9/`)
- [x] Archive, upload with Xcode (1.9 is live)
- [ ] TestFlight test on a real iPhone
- [ ] Enter the App Privacy answers above in App Store Connect (the live listing still says no data is collected, which is wrong)
- [ ] Developer name / copyright line

### Version
1.9.3 (build 15). The live listing showed 1.9 with the old patient-app description and "no data collection" text until this release; update the description, keywords, screenshots and App Privacy answers in App Store Connect as listed above.

---

## Tips for approval

- Use accurate screenshots; do not promise features the app does not have.
- Keep the privacy policy reachable and consistent with the App Privacy answers.
- Answer reviewer questions quickly; typical review time is 1 to 2 days.
- Do not submit with placeholder text or test data visible.
