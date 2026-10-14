# Brief for a Philippine lawyer: Docya

Internal. Send this with `legal/PHILIPPINES.md`, the Privacy Policy (docs/privacy-policy.html) and the Terms (docs/terms.html). Everything in them is the developer's reading of public sources, not legal advice.

## What Docya is
An iPhone appointment book for doctors and dentists in the Philippines. The doctor types in a patient's name, an optional mobile number and private notes. Patients never use the app. The developer is one person; there is no company yet. Data is hosted on Supabase in Seoul, South Korea.

## What is new and why we need you now
A **pilot** will text patients an appointment reminder (doctor's last name, day and time, how to change it; never the reason for the visit; one text per appointment) through Semaphore, a Philippine SMS gateway. A doctor ticks that the patient agreed. It is switched off for everyone and switched on by hand for vetted doctors. The privacy policy and terms are already public and describe this.

## What we ask you to do
1. Review the Privacy Policy and Terms for the Data Privacy Act of 2012, NPC circulars, the SIM Registration Act and consumer law, and tell us what to change.
2. Answer the nine questions in section 5 of `legal/PHILIPPINES.md` (consent evidence, PIC/PIP contract, NPC registration or the sworn exemption and a data protection officer, transfer to Seoul, sensitive data, NTC/telco rules, DTI/BIR before charging, liability and governing law, no licence check on doctors).
3. Tell us what must be in place before the first real text, and what can wait.

## Facts you will want
- Prices planned (not charged yet): free diary; PHP 499 and PHP 1,199 a month; pilot PHP 299. The pilot is free for 30 days.
- No payments are taken today. No analytics or tracking.
- A doctor sees only their own data (row-level security). Export and delete are in the app.
- Reminder records (the patient's number, consent flag, status) are deleted with the appointment or the account. Backups expire on Supabase's schedule.
- Anyone can register as a doctor; there is no licence check. Text reminders are switched on only after a manual check.
