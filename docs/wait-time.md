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
