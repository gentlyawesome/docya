# Docya and Philippine law

Internal working file for the developer and for the Philippine lawyer who reviews Docya. Last written 2026-10-14.

**This is not legal advice.** It is a developer's reading of the laws that appear to touch Docya, built from public sources, with what the app does about each and what is still open. Every statement about the law needs a lawyer's check. Where I could only find a vendor blog or a news summary instead of the law itself, it says so.

## 1. What Docya does with personal data

| Data | Who enters it | Where it lives | Sensitive? |
|---|---|---|---|
| Doctor's email, name, phone, specialization, time zone | the doctor | Supabase (Seoul, South Korea) | personal information |
| Patient's name and optional phone | the doctor, per appointment | Supabase | the fact of a medical appointment is arguably health information |
| Private notes on an appointment | the doctor | Supabase | likely sensitive (health) |
| Patient's mobile number, consent flag, reminder status | the doctor, per appointment, when text reminders are on | Supabase; the number and message also go to the SMS provider (Semaphore) | the number is personal information; tied to an appointment it reveals a medical visit |

Patients are not users, never see Docya, and give nothing to it directly.

## 2. Roles under the Data Privacy Act

- **The doctor** is the personal information controller (PIC) for patient details: the doctor decides what to record and why.
- **Docya (the developer)** is a personal information processor (PIP) for patient details, acting on the doctor's behalf, and the PIC for the doctor's own account data.
- **Supabase, the email provider and Semaphore** are sub-processors of Docya.
- Open: the Act and its rules expect a contract (an outsourcing or data processing agreement) between a PIC and its PIP, and between a PIP and its sub-processors. Today the doctor accepts the Terms and Privacy Policy, which say the above. Whether that is enough is a question for the lawyer.

## 3. Law by law

| Law | Why it matters | What the app does now | Open / to do |
|---|---|---|---|
| **Data Privacy Act of 2012 (RA 10173)** and its [IRR](https://privacy.gov.ph/wp-content/uploads/2023/06/IRR_RA-10173-as-amended.pdf) | Governs all of the above. Health information is sensitive personal information (Sec. 3), which has a stricter basis for processing (Sec. 13). | Privacy Policy names the roles, lists what is stored, retention, rights, transfers, breach handling. Data minimised: no payments, no location, no analytics. Row-level security: a doctor sees only their own rows. Export and delete in the app. | Lawyer to confirm the lawful basis for patient details and notes; processor agreements (see 2). |
| **Consent (DPA Sec. 3(b))** | Consent must be freely given, specific, informed, and evidenced by written, electronic or recorded means. The patient consents to the text, but the doctor is the one who ticks it in Docya. | The switch is off by default, appears only for doctors an operator switched on, and the confirmation shows the number and lead time. The tick is stored with the appointment (`patient_consented_sms`) and cannot be edited later. | The record is the doctor's attestation, not evidence the patient gave. Decide if that is enough, or if the doctor must keep their own record (the Terms already say so). Consider storing who ticked it and when. |
| **Rights of data subjects (DPA Sec. 16)** | Right to be informed, access, correct, object, erasure or blocking, portability, damages. | Doctors can export and delete everything. A patient's request goes to the doctor (the PIC), or to the developer, who passes it on. | Write down how long a patient request may take and who answers it. |
| **Security (DPA Sec. 20, IRR)** | Reasonable organisational, physical and technical measures. | TLS in transit, row-level security, service role used only server-side, secrets in Vault, no phone numbers in logs, fixed message text. Tests cover who can read and write what. | No written security policy; no access log review; Supabase backups and their expiry not documented. |
| **Breach notification (NPC Circular 16-03)** | Notify the NPC and affected people within 72 hours of knowing of a notifiable breach (secondary sources; read the Circular). Processors must also notify. | Privacy Policy promises notice as the law requires. | No incident plan or template. Write a one-page one. |
| **Data Protection Officer and registration ([NPC Circular 2022-04](https://privacy.gov.ph/wp-content/uploads/2023/05/Circular-2022-04-1.pdf))** | A PIC/PIP must designate a DPO. Registration of data processing systems is mandatory at 250 employees, **or when processing the sensitive personal information of 1,000 or more people**, or where processing is likely to pose a risk. Others file a sworn declaration of exemption or register voluntarily. | Nothing filed. | Name a DPO (the developer can be). Decide: register, or file the sworn exemption. Watch the 1,000-person threshold as doctors add patients. |
| **Cross-border transfer (DPA accountability principle; IRR Sec. 50)** | A controller stays accountable for data handled abroad. | Privacy Policy says data is in Seoul and the user agrees to that. | I could not retrieve IRR Sec. 50 itself. Lawyer to confirm the wording is enough. |
| **SIM Registration Act (RA 11934), [text](https://lawphil.net/statutes/repacts/ra2022/ra_11934_2022.html)** | Spoofing a registered SIM or disguising who a text is from is an offence. | Texts go through a Philippine SMS provider, with a fixed message, never disguising the sender. | Semaphore's sender name needs its approval, and its timeline is unknown. Until then the default sender is used. |
| **NTC rules on business SMS** | I found no primary NTC rule for business SMS or sender IDs, only vendor guides (sender IDs pre-registered per network, quiet hours, no promotional content without opt-in). | One text per appointment, appointment-only content, sent 7 am to 8 pm, caps per doctor and per number, consent first. | Check the telcos' (Globe, Smart, DITO) and Semaphore's current sender rules. Get the NTC position in writing if the lawyer thinks it is needed. |
| **Internet Transactions Act (RA 11967), [text](https://www.lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html)** | Covers online merchants selling to people or businesses in the Philippines; the DTI's E-Commerce Bureau keeps a database of online merchants. Whether a subscription app must register is unclear from my sources. | Not applicable until paid plans exist. | Read the IRR and DTI guidance before charging anyone. |
| **Medical Act (RA 2382), Dental Act (RA 9484), PRC licensing** | Doctors and dentists are bound by professional confidentiality and the rules of their licence. | Terms say Docya is for licensed clinicians. | **There is no licence check.** Anyone can register as a doctor (a known, accepted trade-off). Reminders are switched on by hand, so you can check a licence first. |
| **Taxes (BIR)** | Selling subscriptions needs BIR registration and proper invoices; VAT registration is required above a gross sales threshold (reported as PHP 3 million; confirm). Foreign digital services bought for business can carry withholding VAT (RA 12023). | No payments yet. Prices are shown in pesos, "taxes, if any, are added where the law requires". | Talk to an accountant before the first paid plan. |
| **Cybercrime Prevention Act (RA 10175)** | Unauthorised access and data interference are offences. | Nothing to do beyond the security measures above. | |
| **Apple App Store** | Privacy "nutrition label" and a privacy policy URL. | Policy URL set. | Update the label for the new data (patient mobile numbers, reminders). |

## 4. What the app does to limit risk

- Text reminders are off for everyone until an operator switches a doctor on. There is no doctor self-service for it.
- A text goes out only if the doctor ticked that the patient agreed, and only to a valid Philippine mobile number.
- The text names only the doctor, the day and the time. It never says what the visit is for. It is never advertising.
- One text per appointment (retried only if the first attempt fails), 7:00 to 19:59 in the doctor's time zone, at most 3 texts to one number in 24 hours, per-doctor daily (50) and monthly (20) caps.
- Cancelling the appointment withdraws a text that has not gone out.
- Docya does not receive replies. A patient who wants to change or stop contacts the clinic.
- Deleting an appointment or the account deletes its reminder records.
- Logs mask phone numbers.
- Dry run by default (`SMS_LIVE` must be set to `true` to really send).

## 5. Questions for the Philippine lawyer

1. Is the doctor's tick enough evidence of the patient's consent to a text, or must Docya capture more?
2. Do the Terms and Privacy Policy suffice as the PIC-PIP contract with doctors, and what do we need with Semaphore and Supabase?
3. Must Docya register its data processing system with the NPC today, or file the sworn exemption? Who is the DPO?
4. Is the transfer to the Seoul region adequately disclosed and covered?
5. Is storing a patient's mobile number and the fact of an appointment sensitive personal information, and does that change the lawful basis?
6. Anything required by the NTC or the telcos for appointment reminder texts?
7. Do we need to register with the DTI or the BIR (and how to invoice) before charging?
8. Are the limits of liability and the governing-law clause in the Terms valid?
9. Is the "doctor is the controller" arrangement safe when we do not verify licences?

## 6. Action list

- [ ] Lawyer review of the Privacy Policy, Terms and this file
- [ ] Name a data protection officer; decide on NPC registration or the sworn exemption
- [ ] One-page breach response plan
- [ ] Processor terms with Semaphore and Supabase (check their standard DPAs)
- [ ] Semaphore account, API key and sender-name approval
- [ ] Update the App Store privacy label
- [ ] Accountant: BIR registration, VAT, invoicing, before paid plans
- [ ] Document backups and their expiry
- [ ] Decide whether to record who ticked consent and when
