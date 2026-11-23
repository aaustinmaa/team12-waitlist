# Platform V.1: how it fits together

Prototype V.1 is three apps on one engine. **Families** sign in with a one-time code and see every referral linked to their email or phone, at every clinic. **Clinic staff** sign in to their own clinic's portal, bring in exports from whatever system the clinic uses, work the waitlist, and see how the estimates were made and checked. **Referrers** (family doctors, paediatricians) compare each clinic's expected wait for a child referred today before choosing where to refer.

```
clinic system export ──(upload │ nightly sync │ later: API/FHIR)──▶ import
   import: parse → profile (masked) → mapping recipe (saved │ AI │ rules) → convert → validate
   ──▶ referral records (one canonical shape, web/src/engine/types.ts)
   ──▶ engine: fit → back-test & calibrate → simulate each referral → gate
   ──▶ family app (own referrals only)      clinic portal (own clinic only)
```

## Where things live

| Folder | What it does |
| --- | --- |
| `web/src/engine/` | The estimator. Pure TypeScript, no UI, runs the same in a browser or on a server. |
| `web/src/ingest/` | Reading any clinic export: CSV parsing, column profiling, mapping recipes, the Gemini and rule-based mappers, validation. |
| `web/src/platform/` | The demo clinics and accounts, and the store that holds data, sessions, imports and the audit log. |
| `web/src/apps/family/`, `web/src/apps/clinic/`, `web/src/apps/referrer/` | The three apps, each with its own page and address: `index.html` (family, `/`), `clinic/index.html` (portal, `/clinic/`), `refer/index.html` (referrers, `/refer/`). None links to another. `demo/index.html` is the Demo Day guide with the QR codes. |
| `data/samples/` | Three fictional clinics' exports in three formats, made by `generate.mjs`. |
| `supabase/` | The hosted version: database schema with row-level security, and the server function that holds the Gemini key. |

## The estimator (web/src/engine)

Nothing is set by hand per clinic. From the clinic's own records it learns, over the last 26 weeks (a year if the clinic is small):

- how many first assessments it actually did each week (the whole spread, not an average);
- how many urgent and high-priority referrals join the line ahead of others;
- how often someone still in intake or on hold becomes ready and rejoins ahead (they were received earlier);
- how often families leave the list.

For each referral it rebuilds the line and replays the coming weeks 300 times, drawing real weeks from the clinic's history in shuffled blocks. The 10th to 90th percentile is the raw range.

The **back-test** replays every referral that became ready in the past year, using only what was known that day, and compares with when the child was really seen. That gives two corrections: a speed factor (the median of real versus simulated wait) and a widening factor (the smallest that puts 8 in 10 past families inside the range). Coverage is reported in-sample.

A **Kaplan–Meier** curve of the same history, with the people still waiting counted as censored rather than dropped, is shown next to the simulation as a second opinion.

**The gate.** Families see a range only when the clinic has at least 12 recent first assessments, at least 20 past referrals to check, at least 70% of them inside after calibration, and a widening of 2.5× or less. Otherwise families are told there isn't enough history yet, and staff still see the range, marked as staff only. With the samples, Maple Grove (≈82%) and Rivière-Est (≈92%) pass; Lakeshore, small and irregular, doesn't.

The capacity control on the Waitlist page is a **scenario** added to the clinic's real weeks. It never replaces them.

## Imports and AI (web/src/ingest)

Clinics export in different shapes: one row per referral or one row per event, different column names, English or French, different date formats. The import never asks a clinic to reformat anything.

1. The file is read and each column is **profiled**: name, kind of value, a few examples. Emails, phone numbers and name-like values are replaced before anything leaves the browser.
2. A **mapping recipe** says which column is which field, the date format, and how the clinic's codes translate (`P1` to urgent, `ATT` to first assessment done, and so on). If the clinic already has a saved recipe that fits, it is reused. Otherwise **Gemini** proposes one from the masked profile, using structured JSON output, or the **matching rules** do when AI is off. Anything the AI gets wrong (a column that doesn't exist) is dropped, and gaps are filled from the rules and flagged.
3. Staff check the match, with a confidence score per field and the questions the mapper had, and can change anything.
4. Plain code applies the recipe to every row. The AI never touches the rows: that keeps the result reproducible and auditable, and keeps patient data away from the AI.
5. Validation rejects impossible rows, such as a closure before the referral was received or duplicate IDs. It compares with the last import, and a referral that silently vanished is kept and flagged for review instead of dropped.
6. The recipe is saved. Nightly syncs reuse it with no AI call. If the export's columns change, the sync stops and asks a person.

## The referrer page (/refer/)

Clinics run their own waitlists; nobody central knows which one is shortest. Where a referrer has a choice (community and private clinics, nearby regions, OT or PT), the referrer page shows, for each taking-part clinic:

- the expected wait to a first assessment for a child referred today, at the priority the referrer picks (the engine's new-referral range, calibrated like every family's);
- how many children are waiting, recent first assessments a week, typical intake time, and how often past estimates held;
- languages, who the clinic serves, and how to send the referral.

It is built from `lib/referrer.ts` (pure functions over a clinic's view) and `platform/directory.ts` (which data to use). Design choices:

- **Same gate as families.** A clinic whose history is too short shows "No estimate yet" in neutral grey and is listed last, with a note that this says nothing about its quality.
- **Totals only.** No referral IDs or contact details reach the page (tested).
- **Herding.** If many referrals go to one clinic, its line grows and its estimate rises at the next import; the page says so.
- **Eligibility first.** Many public programs only take their own area; the page reminds referrers to check.
- **Opt-in, referrers only.** Clinics share with referrers, not the public. The demo has a one-tap demo referrer; the real service would use verified clinician accounts.

Data: on a device that has a clinic's data (the local demo), the page uses it, so a staff change in the clinic portal shows up. Otherwise it uses the clinic's latest sample export, standing in for the summary the clinic would publish after its nightly sync. In the hosted version each clinic would publish this summary next to the one it already publishes for families.

## Sign-in

- **Families**: no passwords. A 6-digit code goes to the email or mobile the clinic has on the referral. In the hosted version that is Supabase Auth with email OTP or SMS OTP, the latter needing an SMS provider. In the demo the code appears in the demo inbox.
- **Referrers**: in the demo, one tap as a demo family doctor. Real service: verified clinician accounts (for example Ontario Health OneID).
- **Staff**: invite-only accounts with roles. **Admin** imports and manages settings. **Intake** works the waitlist. **Manager** sees reports only. Hosted: email and password plus a two-step code, or the clinic's Microsoft 365 sign-in. Every sign-in, view of a family's page, priority change (with its required reason) and import goes in the audit log.

## Switching on the hosted version (Supabase)

Step by step: [supabase-setup.md](supabase-setup.md). In the hosted version the estimator still runs in the clinic portal. After every import or staff change it publishes each referral's estimate and a non-identifying clinic summary, and families read only those rows for their own referrals. Families never download the waitlist.

## What the demo simulates

- The nightly sync. "Run tonight's sync now" picks up the next sample export.
- Email and text messages. They show in the demo inbox and on the Waitlist's outbox.
- Storage. Everything is in the browser's localStorage. Settings → Reset demo data puts it back.
- All referral data. It is synthetic. See `data/samples/generate.mjs` for how it was tuned against public figures.

## QR codes

`/demo/` shows a QR code for each app. The poster carries two (family app, clinic portal); the referrer page's code is saved too. Copies are saved in `docs/qr/`; regenerate them with `node web/scripts/make-qr.mjs [base-url]`. They point to the public GitHub Pages site, which only shows this version after it is merged into `main`.

**The poster prints these three addresses: `/`, `/clinic/?local` and `/refer/`.** Every merge into `main` redeploys to the same addresses, so new versions show up behind the printed codes with no reprinting. Don't move or rename these pages, and don't drop `?local` support; `web/src/entrypoints.test.ts` fails if you do.
