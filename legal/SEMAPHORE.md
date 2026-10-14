# Semaphore: what to set up and what to ask

Internal. Semaphore ([api.semaphore.co/docs](https://api.semaphore.co/docs)) is the Philippine SMS gateway the reminder function sends through. Facts below are from its public documentation, read 2026-10-15. Check them again on your own account.

## What the function needs from the account
- An **API key** (dashboard).
- A **registered sender name.** Semaphore's docs say it throws an error when the account has no registered sender name and none is given. The function sends none unless `SEMAPHORE_SENDER_NAME` is set, so either register one and let it be the account default, or put it in `supabase/functions/.env`.
- **Credits.** One credit is one text of up to 160 plain characters (Docya's reminder is plain ASCII and under 160, so one credit each). Failed texts are refunded. The homepage lists about PHP 0.56 a text before VAT (check).
- Texts that start with the word "TEST" are silently dropped. Docya's text starts with "Reminder:".
- The regular endpoint allows 120 calls a minute. Docya sends at most 20 per run.

## Questions to ask Semaphore (email or chat)
1. How do I register a sender name, how long does approval take, what documents are needed, and is there a fee? Can I send from the default "SEMAPHORE" sender while it is pending?
2. Do appointment reminders to patients count as transactional traffic on all Philippine networks (Globe, Smart, DITO)? Any content or timing rules I must follow?
3. Do you offer a data processing or confidentiality agreement? Where are messages and recipient numbers stored, and for how long? Can they be deleted on request?
4. Is the message text logged on your side? (Docya's texts name a doctor, a day and a time, never the reason for the visit.)
5. What does the API return on a bad number, no credits, or a rate limit (HTTP status and body)? The docs do not say.
6. Do you support replies or opt-out keywords? (Docya does not read replies today.)
7. Is there a test mode or sandbox that does not send or charge?

## Before the first real text (Docya Dev)
1. Put the key (and sender name if needed) in `supabase/functions/.env`, never in the app's `.env` and never in chat.
2. Upload: `supabase secrets set --env-file supabase/functions/.env --project-ref fhmtibdtvlpiculqkqco`
3. Turn live mode on for Dev only: `supabase secrets set SMS_LIVE=true --project-ref fhmtibdtvlpiculqkqco`
4. Send one text to your own number:
   `CRON_SECRET=<dev secret> TEST_PHONE=09XXXXXXXXX node supabase/tests/hosted-live-test.mjs --yes-send-one-real-text`
5. Check your phone, then switch Dev back to a dry run: `supabase secrets unset SMS_LIVE --project-ref fhmtibdtvlpiculqkqco`.
Production stays on a dry run until the lawyer review is done and one vetted doctor is chosen.
