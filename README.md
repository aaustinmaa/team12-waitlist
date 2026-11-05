# Team 12 Waitlist

This project prototypes wait-time estimates for families waiting for non-emergency childhood developmental services. The first demo covers one fictional clinic and the wait until a child's first speech-language assessment.

| Path | What belongs here |
| --- | --- |
| [`web/`](web/) | Family referral view and clinic staff dashboard |
| [`backend/api/`](backend/api/) | API for the two views |
| [`backend/estimator/`](backend/estimator/) | Wait-time estimation and its evaluation |
| [`backend/ingestion/`](backend/ingestion/) | Validation and loading of referral and capacity data |
| [`data/demo/`](data/demo/) | Synthetic cases for development and walkthroughs |
| [`docs/`](docs/) | Shared definitions and response contract |

## Start here

New to coding or working with an AI assistant? Open the [team onboarding guide](docs/team-onboarding.md) and copy its starter prompt. Coding assistants should read [AGENTS.md](AGENTS.md) before editing.

1. Read the [wait-time definition and response contract](docs/wait-time.md).
2. Use the [available](data/demo/estimate-available.json) and [unavailable](data/demo/estimate-unavailable.json) cases to build and test the family view.
3. Use the same response contract when adding the API. For the staff demo, show the service waitlist and let a staff member change simulated appointment availability. The family view can then refresh its estimate.

This is the starter scaffold. The application and estimation model are the next implementation steps. Use synthetic data throughout the course prototype.
