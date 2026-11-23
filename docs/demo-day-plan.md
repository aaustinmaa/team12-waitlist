# Demo Day plan: technical solution

Poster copy, design-process fixes, script, and how we run the demo. Read against the poster as of Nov 23 (Canva "Thurs-Team12") and the notebook's P5 entry.

## 1. QR codes: two, not one

Put **two** codes in the Technical box. The `/demo/` guide stays on the presenter's laptop as a cheat sheet.

| Code | Link | Line under it |
| --- | --- | --- |
| Family app | `https://aaustinmaa.github.io/team12-waitlist/` | Tap **Open the demo family** |
| Clinic portal | `https://aaustinmaa.github.io/team12-waitlist/clinic/?local` | Tap a demo account, then **Sign in** |

Why two:
- **Faster.** A visitor is in after one scan and one tap. With a single code, they would scan, read a guide page, choose, and tap again.
- **Familiar.** The storyboards already use two codes, one per perspective, so visitors know the pattern.
- **It shows the design.** Separate apps with separate sign-ins is the point. Families never see the clinic's side.

Why the clinic code ends in `?local`: the live site shares one database. Without `?local`, every visitor would sign in as the same Maple Grove admin and could change priorities or run syncs for everyone, including the family app we are demoing. With `?local`, each phone gets its own private copy and nothing a visitor does reaches anyone else. The family code stays on the shared site because families can only read. That also means a change the presenter makes in the clinic portal shows up on visitors' phones.

What's on the poster now:
- The "STAFF PERSPECTIVE" code opens `…/#/family/demo-001`, which lands on the family sign-in.
- The "PAITIENT PERSPECTIVE" box has no code.

## 2. Poster: Technical (Solutions section)

The box is all screenshots, and they show the old capacity slider (5 → 7 slots/week). Replace it with about 150 words of text and two small screenshots:
- **Family**: the "Your referrals" list, or one referral page.
- **Clinic**: the import mapping screen or the Model page with its coverage.

> **Technical: wait estimates from each clinic's own records**
>
> **Goal:** tell families how long they are likely to wait, using their clinic's real records, and only once the estimate has proven reliable.
>
> Two connected apps. **Families** check their child's referral and a realistic wait range. **Clinic staff** bring in the waitlist they already keep and manage it.
>
> **① Import.** The clinic uploads the export its system already produces, whatever the columns or language. AI (Gemini) suggests which column is which from a masked preview, staff confirm, and plain code converts every row. Patient data never goes to the AI.
>
> **② Estimate.** The engine learns how many first assessments the clinic really does each week, how often urgent referrals join ahead, and how often families leave. It then plays out the coming weeks 300 times.
>
> **③ Check before showing.** We replay last year's referrals. Families see a range only if real waits fell inside it often enough (our sample clinics: 82% and 92%). Otherwise the app says "not enough history yet" instead of guessing.
>
> **Families:** one-time code, no account or password · every referral at every clinic · "This is not an appointment."
> **Staff:** invite-only roles · priority changes need a reason · every view and change is logged.
>
> *React + TypeScript · Supabase (Canada) · Gemini · all data is synthetic*

## 3. Poster: Design Process

**Technical row.** Each design shows *what* changed but not *why*. Add one short "why" line under each arrow. Each reason is already in the notebook (D4, D6, TC2):

| Arrow | Caption (≤ 15 words) | Source |
| --- | --- | --- |
| Design 1 → 2 | Partners: care complexity matters more than demographics, and each clinic runs its own list | D4 |
| Design 2 → 3 | Peer review: walkthrough, appointment details, clearer reports, notifications | D6 |
| Design 3 → Final | Consultants: replace hand-set capacity with the clinic's own data, checked against past waits | TC2 |

Also replace the two "Final Prototype" thumbnails. They show the old staff dashboard with the slider. Use V.1 screenshots: the family referral list and the clinic import/Model page. Design 3, which estimates from hand-set slots, can stay as history.

**Non-technical row.** Same idea, for Miriam: one reason per arrow, e.g.:
- "Partners: students giving clinical advice is a liability → universal, non-clinical program" (D4)
- "Peer review: who runs it? → Volunteer Coordinator" (D6)

**Elsewhere on the poster:**
- Section title: "REITERATIONS" → "ITERATIONS".
- "PAITIENT PERSPECTIVE" → "FAMILY APP". Use "CLINIC PORTAL" for the other box.
- Phase 2 typos: "supporing" → "supporting", "intitiatives" → "initiatives", "programs build" → "programs built".
- Citation 3: delete `?utm_source=chatgpt.com` and the stray `[ ](…)` link formatting.
- Looking Ahead: "Explore integrations with EMR" is partly done now, since we import EMR exports. Suggest: *"Pilot with one clinic's de-identified export; PHIPA privacy review; direct EMR/FHIR connection."*
- 3 Surprises, script #1 says the first estimate used "demographic (age and race)". Saying "race" out loud invites a hard question. Suggest "basic demographics", and end with the V.1 answer: *"Now the estimate comes from the clinic's own history, and we only show it after checking it against what really happened."* (Jane's section; ask her.)

## 4. Script (for the notebook, P5)

The notebook has scripts for the Problem, Stakeholders and Surprises sections. Section 2 (process) and Section 3 tech (solution) are empty. Write them so that anyone on either presenting team can deliver them.

### Section 2: process, technical part (~1 min)

> Our technical idea started as a sketch: a page where families could see where they are on the waitlist. At co-creation, partners from KidsAbility told us two things. First, the complexity of a child's care predicts the wait better than demographics. Second, every clinic runs its own list. So we narrowed it to one clinic and one milestone: the first speech-language assessment.
>
> Peer review gave us a walkthrough, appointment details, clearer reports and notifications. Then at technical consultation the consultants asked the hard question: where do the numbers come from? Our estimate still ran on capacity we set by hand. Version 1 is our answer. It learns from each clinic's own records, and it checks itself against past waits before a family sees anything.

### Section 3: technical solution (~2 min)

> Our technical solution is two connected apps. One is for families, one for clinic staff.
>
> *(Point at the phone.)* A parent signs in with their email or phone number. They get a one-time code. There's no account and no password. They see every referral their child has, at every clinic. For each one they see where it stands, and a range, like "about 16 to 22 more weeks." We always say it's an estimate, not an appointment.
>
> *(Point at the laptop.)* On the clinic side, the clinic doesn't have to change anything. They upload the export their system already makes. Every system names its columns differently, so AI suggests which column is which. The AI only sees a masked preview, never patient data. Staff confirm, and plain code does the conversion.
>
> From that history, our engine learns how fast this clinic actually sees children, how often urgent cases jump ahead, and how often families leave. Then it plays out the coming weeks 300 times to get a range.
>
> The part we're proudest of is that it checks itself. We replay last year's referrals and ask: would the range have been right? At our sample clinics it was right 82% and 92% of the time. A small rural clinic didn't have enough history, so families there are told that honestly instead of being given a guess.
>
> Everything here is synthetic data. Scan the codes to try both apps yourself.

### 30-second version (passers-by, between full talks)

> Families on Ontario's speech-therapy waitlists wait months with no information. Our app gives them an honest wait range for their child. It comes from their clinic's own records, and we only show it once we've checked it against real past waits. Clinics just upload the export they already have. Scan here to try the family side, and here for the clinic side.

## 5. On the day

**Set-up**
- **Laptop.** Clinic portal on the live site, signed in as `intake@maplegrove.example`. This account is for the presenter only; visitors use `?local`.
- **Phone or tablet.** Family app on the live site, opened with "Open the demo family".
- **Second laptop tab.** `/demo/`, as a cheat sheet.
- **Poster.** The two QR codes.

**Live demo, about 2 minutes, during Section 3**
1. Phone: the family list shows MG-00636 at "about 16–22 more weeks". Open it and point at "This is not an appointment" and the steps.
2. Laptop: **Data** → run tonight's sync. The import shows what changed, and a referral that vanished is flagged for review, not deleted.
3. Laptop: **Model** shows the back-test (82%). Switch to Lakeshore: "not enough history", so families get no number.
4. Laptop: **Waitlist** → raise MG-00636's priority. A reason is required. Refresh the phone and the range moves. Change it back afterwards.

**Day before (must do)**
- [ ] On the live site, sign in to the clinic portal on the laptop and confirm that step 4 updates the phone. Hosted staff sign-in hasn't been tested by hand yet.
- [ ] Reset the hosted data to the starting state and note the numbers the script quotes.
- [ ] Scan both printed codes at poster size with an iPhone and an Android phone, on campus Wi-Fi.
- [ ] Backup if the network or Supabase fails: `?local` in two tabs on the same laptop (they share browser storage), plus screenshots.

**Questions to be ready for**
- *Is this real data?* No. It's synthetic, generated to match public Ontario wait figures.
- *Why not just show the average wait?* An average hides urgent cases jumping ahead and slow weeks. A range that has been tested is honest.
- *Why use AI at all?* Only to read differently formatted exports. It never sees names or contact details and never makes the estimate.
- *What if the estimate is wrong?* It says "may change". It updates with every import. A clinic that fails the check shows no number.
- *Privacy?* Families see only their own referrals. Staff see only their own clinic. Data is stored in Canada. Every view is logged.
- *How would a clinic start?* One upload. The column matching is saved, and nightly exports reuse it with no AI.

Feedback: as planned in P5, one member per presenting team writes down questions and feedback, and adds them to D8 afterwards.
