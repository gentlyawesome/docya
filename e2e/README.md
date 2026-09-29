# End-to-end tests (Maestro, iOS simulator)

These drive the real app on a booted iOS simulator through accessibility labels.

1. Install Maestro once: `brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro` (needs Java 17+)
2. Boot a simulator and install a Debug build (`npx react-native run-ios`), then keep Metro running (`npm start`)
3. Run everything: `npm run e2e`, or one flow: `maestro test e2e/book-and-cancel.yaml`

Notes
- Every flow starts with `clearState`, so it wipes the app's data on that simulator.
- Flows pick the first open slot, so they do not depend on the time of day. They do use the live doctor list.
- Not covered: reminders (need the system permission dialog and a wait for the notification) and the offline banner.
