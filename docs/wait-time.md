# Wait-time definition and response contract

## Which wait are we measuring?

The prototype starts the calendar wait on the date the receiving clinic records the referral and ends it on the date the first speech-language assessment takes place. The clinic still needs to confirm both milestones. The family view shows an estimate of the **remaining wait from the date the estimate was calculated**.

Record hold periods separately with a start date and an end date. An open hold has no end date yet. Keeping those dates separate preserves the full calendar wait and lets the team calculate time on hold once the clinic confirms which periods count in its reporting.

For model development, retain referrals that are still waiting. Their observed wait runs up to the data cutoff and their assessment date is unknown. Use an approach that can handle these incomplete observations before evaluating the model on clinic data.

## Family referral response

| Field | Meaning |
| --- | --- |
| `referral.id` | Stable synthetic referral ID in the demo |
| `referral.service` | Service name to display |
| `referral.status` | Confirmed status from the referral record |
| `referral.received_on` | Date the receiving clinic logged the referral (`YYYY-MM-DD`) |
| `estimate.status` | `available` or `unavailable` |
| `estimate.milestone` | The event being estimated, `first_assessment` in this demo |
| `estimate.as_of` | Date from which the range is measured (`YYYY-MM-DD`) |
| `estimate.range_weeks` | `lower` and `upper` bounds when available, `null` otherwise |
| `estimate.message` | Plain-language explanation for the family |
| `clinic.contact` | Where the family can ask for help |

An unavailable estimate leaves the referral status visible. When a range is available, label it as an estimate and show when it was calculated. The example range is illustrative.

### Prototype additions

The web prototype adds a few optional fields. The fields above keep their meaning, and a client that ignores the additions still works.

| Field | Meaning |
| --- | --- |
| `referral.appointment_on` | Confirmed first-assessment date when the status is `assessment_booked` |
| `estimate.reason` | Why no range is shown: `intake_incomplete`, `on_hold`, `booked`, or `beyond_horizon` |
| `referral.hold` | The referral's hold (`start`, `end`, `reason`), current or past. Only present when it has one |
| `referral.days_on_hold` | Days on hold up to `estimate.as_of`. Only present with `referral.hold` |
| `clinic.name`, `clinic.phone`, `clinic.hours` | Extra details for the family's contact card |
| `clinic.portals` | Other patient portals the family may use (`id`, `name`, `url`). Links only; nothing is shared with them |
| `priority` | `urgent`, `high` or `standard`, set by the clinic's clinicians |
| `appointment` | When booked: `on`, `start_time` (clinic time, `HH:MM`), `duration_minutes`, `timezone`, `location` (`name`, `address`, `room`) and `clinician` (`name`, `role`, `registration`, `languages`) |
| `intake` | How long an estimate usually takes to appear: `typical_days` and `most_within_days` (median and 90th percentile, referral received to intake complete, over the past year) and `days_since_received` |
| `contact_on_file` | Masked email and phone the clinic has on file, where updates are sent |

The `status` value `on_hold` marks a referral that is paused but still on the waitlist. `assessment_booked` marks one with a confirmed first-assessment date.

## Priority

The clinic's clinicians give each referral a priority: `urgent`, `high` or `standard` (the default). Referrals ready to book are seen in priority order, then by `received_on`, so a referral's place in line already counts everyone of a higher priority. The estimate also allows for referrals that arrive later and are placed ahead, at the rate this clinic's own data shows, and for referrals received earlier that are still in intake or on hold rejoining ahead when they become ready. Raising one referral's priority moves it up and pushes everyone it passes back by one place. The staff dashboard shows the range a new referral would be told at each priority.

## Updates to families

When a staff change alters what a family sees, the family is told: when an estimate becomes available, when the range moves by 2 weeks or more at either end, and when an estimate can no longer be shown. Smaller shifts are not announced, but they add up, so a range that drifts 1 week twice is announced the second time. Families choose email, text message or notifications on their device; by default email is on. In the prototype nothing is sent: updates show on the family page, in *Updates sent to families* on the staff dashboard, and as a device notification when the family switched that on.

## Time on hold

Time on hold is the part of the calendar wait when the referral was paused for a reason outside the clinic's capacity, for example a family request, travel, illness, or waiting for a hearing test. The prototype keeps it as its own number instead of folding it into, or removing it from, the wait:

- **Family view.** "Waiting so far" stays the full calendar wait, because that is what the family lived through. A note underneath gives the time on hold. An open hold also shows its start date and reason.
- **Staff dashboard.** The Waiting column is the full calendar wait, with the time on hold underneath. The spreadsheet download has `days_waiting`, `days_on_hold`, and `days_waiting_excluding_hold`.
- **Reports.** The median wait to first assessment stays holds included. The tile also gives the median excluding holds, which is the part the clinic's capacity is responsible for. The downloads add those columns.
- **Estimate.** No range is shown while a referral is on hold, because the estimator can't predict when a hold ends. The referral keeps its place in line, ordered by `received_on`, so the range comes back when the hold ends.

A hold counts from its `start` day up to, but not including, its `end` day. An open hold counts up to the snapshot date. Whether a clinic restarts the line after a hold, and which hold reasons it excludes from its official wait, still needs to be confirmed with the clinic.

## Referral records

Every clinic export is converted into one record per referral (`web/src/engine/types.ts`). Dates are `YYYY-MM-DD`.

| Field | Meaning |
| --- | --- |
| `referral_id` | The clinic system's ID for the referral |
| `priority` | `urgent`, `high` or `standard` |
| `received_on` | Date the clinic logged the referral |
| `intake_completed_on` | Date the referral became ready to book, when an estimate can be shown |
| `hold_start`, `hold_end`, `hold_reason` | The latest hold; `hold_end` is empty while it is open |
| `booked_for`, `booked_time`, `clinician` | The booked first assessment, while the referral is open |
| `closed_on`, `close_reason` | When and why it left the waitlist: `assessed` or `withdrawn` |
| `age_group`, `referral_source` | Used by the reports only, never by the estimator |
| `family_email`, `family_phone` | Used only for family sign-in and updates |
| `needs_review` | Set when the referral vanished from the latest export without being closed |

Wait to first assessment in the reports is `closed_on` minus `received_on`, holds included. "Estimate held" compares the back-tested range at intake with the real wait, in weeks from intake. The estimator itself is described in [platform.md](platform.md).
