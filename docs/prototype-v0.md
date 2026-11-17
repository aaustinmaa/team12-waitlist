# Prototype V.0

Prototype for D5 and the Week 8 peer evaluation. It runs entirely in the browser with synthetic data for one fictional clinic, Maple Grove Children's Centre, and one milestone: the first speech-language assessment.

Live demo: https://aaustinmaa.github.io/team12-waitlist/ (updates after each merge into `main`).

## What it shows

**Family view** (`#/family/:id`, phone and computer layouts)

- Referral status in a solid card labelled *Confirmed by the clinic*: status, date received, time waited so far, referral ID.
- Wait estimate in a separate dashed card labelled *Estimate · may change*: the range in weeks, the likely date window, a range bar from today, when it was calculated, a "this is not an appointment" note, and what could change it.
- When there's no estimate, the page says the place on the waitlist is kept, when an estimate usually appears, that the family will be told, and links straight to the clinic contact.
- Referral steps (received → on the waitlist → appointment booked → first assessment), clinic contact card, and a *While you wait* card that links to community programs (the non-technical solution).

- **Layout.** On a computer, the side column holds only the two short cards a family needs at hand: how to contact the clinic and how they'll hear about changes. *While you wait* and the other health portals run across the full width below, and *How we estimate* folds away under the estimate. The side column went from about 2.6 times the height of the main column to shorter than it.

**Staff dashboard** (`#/staff`, table on a computer, cards on a phone)

- Counts for ready to book, needs intake info, on hold, and booked.
- Weekly first-assessment capacity (1–10 slots, usual 5). Changing it re-runs every family's estimate and the "a family referred today would be told" range.
- Waitlist with filters and ID search. Holds and incomplete intake are flagged, and each row shows what the family currently sees.
- **Preview** opens the family view for any referral. **Intake done** marks missing intake information complete so that referral gets an estimate.
- **Download spreadsheet** (in the bar just above the waitlist) saves the referrals currently shown as a .csv file for Excel or Google Sheets. The bar says how many rows will be in the file, and confirms the file name after the download. Filter and search apply. Referral IDs only, no names.

**Staff reports** (`#/staff/reports`, the *Reports* tab on the staff dashboard)

For a staff member preparing a quarterly report for a manager. Pick a quarter; everything on the page follows it.

- Tiles: referrals received, first assessments, median wait to first assessment, waitlist size at quarter end, and how often the wait estimate held, each compared with the previous quarter.
- Charts (the selected quarter is shaded): waitlist size by week, referrals in vs. first assessments out by month, and median and 90th-percentile wait by month.
- *Did the estimate hold?*: for every child assessed in the quarter, the range the family would have seen once intake was complete next to the wait that actually followed. A 10th–90th percentile range should hold for about 8 in 10 families.
- Breakdowns by referral source and age group.
- A **Download this report** box near the top with three options, each saying what is in it: *Referrals in [quarter]* (spreadsheet), *Quarter-by-quarter summary* (spreadsheet), and *This page as a PDF* (opens the print window). Each chart also has a *Show as table* view; charts are not downloaded one by one, they are all in the PDF.

The history behind these numbers is `data/demo/clinic-history.json`: 182 synthetic referrals that had a first assessment or were withdrawn between April 2025 and November 2026. `data/demo/generate-history.mjs` creates it with a fixed seed. Combined with the current queue, it shows referrals slowly outpacing about two first assessments a week, so the median wait grows from about 10 to about 18 weeks. The estimate check is a back-test made with the generator, not output from the simulated estimator.

The capacity and intake changes are shared between the two views and saved in the browser. Use **Reset demo** on the demo home before each participant.

## Demo cases

| ID | Case | At the starting state |
| --- | --- | --- |
| `demo-001` | Estimate available | Waiting, 6–10 weeks from November 5, 2026 (matches `data/demo/estimate-available.json`) |
| `demo-002` | No estimate yet | Waiting, intake information incomplete (matches `data/demo/estimate-unavailable.json`) |
| `demo-003` | Assessment booked | First assessment confirmed for November 26, 2026 |

The rest of the 38 referrals in `data/demo/clinic-queue.json` fill the waitlist.

## How the simulated estimate works

`web/src/lib/estimator.ts` places each referral that is ready to book in line by referral date. It then simulates the coming weeks 400 times. In each run, how reliably the planned slots are kept varies between 60% and 100%, about one urgent referral every four weeks takes a slot first, and booking adds 0–2 weeks before the appointment. The 10th–90th percentile of those runs is the range a family sees. Referrals on hold, booked, or missing intake information get no range. A range whose upper end passes 52 weeks is shown as unavailable.

The random seed is fixed per referral and capacity, so the same setting always gives the same range. This is a demonstration of the interaction, not a validated model. The parameters were chosen so that `demo-001` reproduces the 6–10 week fixture.

## Peer-evaluation tasks

The demo home has a *For facilitators* panel with the same tasks and links.

**Task 1 · How much longer is the wait?**
"You got a message that your child's speech-language referral was registered. You want to know how much longer your child might wait."

1. Open the family view for `demo-001`.
2. Find the confirmed status, *Waiting for first assessment*.
3. Find the estimate: about 6–10 more weeks, most likely between December 17, 2026 and January 14, 2027.
4. Read the note that this is not an appointment and may change.

Watch for: can they say what the range measures? Do they treat it as a booked appointment?

**Task 2 · No estimate: is my referral still there?**
"You can't see a wait estimate. You want to check your referral is still on the waitlist and know who to contact."

1. Open the family view for `demo-002`.
2. Find the confirmed status: still waiting, place kept.
3. Understand that no estimate is available yet, and why.
4. Find the clinic's email or phone and the referral ID to mention.

Watch for: do they think the referral disappeared or was cancelled? Can they find a person to contact on their own?

**Extra · Staff changes capacity**
"You work on the intake team. A new clinician starts next week, so the clinic can offer more first assessments."

1. Open the staff dashboard.
2. Raise slots per week from 5 to 7.
3. Preview `demo-001` and see its estimate shorten (5–8 weeks at 7 slots).
4. Mark intake done for `demo-002` and see it get an estimate.

Watch for: is the link between capacity and what families see clear? Is it obvious which screen is staff-only?

## Changes after the Week 8 peer evaluation

**Family view**

- **No estimate yet.** Says when an estimate usually appears (from the clinic's past referrals: about 6 days, 9 in 10 within 21 days) and how long ago this referral was received. If it has taken longer than usual, it suggests asking the clinic. On hold and too-long cases say what brings the estimate back.
- **Updates.** "We'll let you know": the family sees where updates will go. It starts from the clinic's records (shown masked), and the family can enter their own email or mobile number instead; both are checked for typos, and a phone number is tidied to 519-555-0123. Email, text message and device notifications switch on or off separately. The latest update is shown, with the rest a click away, and one that arrives while the page is open appears at the bottom of the screen. In the prototype, what a family enters is kept only in their browser and cleared by *Reset demo*.
- **Booked appointment.** Time, place, room and the clinician (name, registration, languages), with *Add to your calendar*: an .ics file for Apple Calendar and Outlook, or Google Calendar and Outlook.com links. Reminder one day before. The referral ID goes in the file only, not in the links.
- **While you wait.** Links to EarlyON centres, Hanen tips for parents, Ontario's Preschool Speech and Language Program and 211 Ontario, plus the two example local programs. A separate card links to other patient portals (ConnectMyHealth, MyChart, Health811).
- **Languages.** English, French, Simplified Chinese, Traditional Chinese, Spanish and Arabic (right to left). Traditional Chinese uses Hong Kong and Taiwan wording (轉介, 短訊, 裝置), not a character swap of the Simplified text, and browsers set to zh-TW or zh-HK get it automatically. The choice is remembered per browser and starts from the browser's language. Staff pages stay in English.
- **Guided tour.** Opens on the first visit and from *Take the tour*. It skips parts that aren't on the page.

**Staff dashboard**

- Priority per referral (urgent, high, standard). The line is ordered by priority, then date, and the estimate accounts for it. The "a family referred today" box shows the range at each priority.
- *Updates sent to families* lists what was sent after each change, by which channels.
- Appointment time and clinician in the waitlist and the download.

**Reports**

- *Right now* at the top: children on the waitlist today in large type, with waiting, booked and on hold, the change over 4 weeks, the wait to first assessment over the last 90 days, and how long children still waiting have waited.
- *Referrals in and first assessments out* is a bar chart with the count on each bar. The selected quarter is in full colour.
- *Wait to first assessment* lists the median, 9-in-10, shortest and longest wait for the quarter, and labels the latest values on the lines.

**Everywhere**

- Dark mode: the button at the right of the header cycles *Same as device*, *Light* and *Dark*.
- Buttons that can't be used are grey. Labels that are not buttons ("Confirmed by the clinic", "Estimate · may change") are plain grey text instead of coloured pills.

## Not in this version

Chatbot, multiple clinics, EMR connection, sign-in, real data, real email and text messages, and a trained model. Translations were written for the prototype and still need review by native speakers. Hold rules, the start and end of the wait, and which fields can be shared with families still need confirmation from a clinic.
