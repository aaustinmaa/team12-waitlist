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

The `status` value `on_hold` marks a referral that is paused but still on the waitlist. `assessment_booked` marks one with a confirmed first-assessment date.

## Time on hold

Time on hold is the part of the calendar wait when the referral was paused for a reason outside the clinic's capacity, for example a family request, travel, illness, or waiting for a hearing test. The prototype keeps it as its own number instead of folding it into, or removing it from, the wait:

- **Family view.** "Waiting so far" stays the full calendar wait, because that is what the family lived through. A note underneath gives the time on hold. An open hold also shows its start date and reason.
- **Staff dashboard.** The Waiting column is the full calendar wait, with the time on hold underneath. The spreadsheet download has `days_waiting`, `days_on_hold`, and `days_waiting_excluding_hold`.
- **Reports.** The median wait to first assessment stays holds included. The tile also gives the median excluding holds, which is the part the clinic's capacity is responsible for. The downloads add those columns.
- **Estimate.** No range is shown while a referral is on hold, because the estimator can't predict when a hold ends. The referral keeps its place in line, ordered by `received_on`, so the range comes back when the hold ends.

A hold counts from its `start` day up to, but not including, its `end` day. An open hold counts up to the snapshot date. Whether a clinic restarts the line after a hold, and which hold reasons it excludes from its official wait, still needs to be confirmed with the clinic.

## Referral history for staff reports

`data/demo/clinic-history.json` holds referrals that have left the waitlist. The Reports page joins it with `clinic-queue.json`, which holds the referrals still waiting.

| Field | Meaning |
| --- | --- |
| `id` | Synthetic referral ID (`h-` prefix) |
| `received_on` | Date the clinic logged the referral |
| `intake_completed_on` | Date intake information was complete, so an estimate could be shown |
| `age_group`, `referral_source` | Same values as the queue |
| `outcome` | `assessed` (first assessment done) or `withdrawn` |
| `closed_on` | First-assessment date, or the date the referral was withdrawn |
| `withdrawn_reason` | Only when `outcome` is `withdrawn` |
| `hold` | Same shape as the queue: `start`, `end`, `reason` |
| `estimate_at_intake` | Back-test: `as_of`, `lower_weeks`, `upper_weeks` of the range the family would have seen at `intake_completed_on`. `null` for withdrawn referrals |

Wait to first assessment in the reports is `closed_on` minus `received_on`, holds included. Wait excluding holds subtracts the days on hold before `closed_on`. "Estimate held" means the weeks from `estimate_at_intake.as_of` to `closed_on` fell within `lower_weeks`–`upper_weeks`.
