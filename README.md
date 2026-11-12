# Team 12 Waitlist

This project prototypes wait-time estimates for families waiting for non-emergency childhood developmental services. The demo covers two fictional clinics and the wait until a child's first speech-language assessment.

| Path | What belongs here |
| --- | --- |
| [`web/`](web/) | Family referral view and clinic staff dashboard |
| [`backend/api/`](backend/api/) | Waitlist data access and clinic connection rules |
| [`backend/estimator/`](backend/estimator/) | Wait-time estimation and its evaluation |
| [`backend/ingestion/`](backend/ingestion/) | Validation and loading of referral and capacity data |
| [`data/demo/`](data/demo/) | Synthetic cases for development and walkthroughs |
| [`docs/`](docs/) | Shared definitions and response contract |

## See the prototype

**[Open the live demo](https://aaustinmaa.github.io/team12-waitlist/)**. It works on a phone or a computer, with no sign-in and nothing to install. It updates a few minutes after each merge into `main`. Every page uses fictional, synthetic data, and **Reset demo** on the home page undoes changes made in the staff dashboard.

## Start here

- [Thur-Team-12 team notebook](https://docs.google.com/document/d/11Euk5jO0elSPw9EsWZbbdWqb8sB7RWLwu1zwEFyLbCA/edit?tab=t.0) for project scope, design decisions, and course records.
- [Team guide](docs/team-onboarding.md) for viewing the prototype, suggesting changes without coding, and contributing from GitHub, Google AI Studio or Codex Desktop.
- [Publishing guide](docs/demo-publishing.md) for sharing an approved online demo. AI coding assistants should read [AGENTS.md](AGENTS.md) before editing.

## Run the prototype

You need Node.js 20 or newer.

```bash
cd web
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). `npm test` checks the family response contract and the shared-capacity workflow, and `npm run build` makes a static copy in `web/dist/` that any static host can serve.

| Page | Path | Who it is for |
| --- | --- | --- |
| Demo home | `#/` | Facilitators: pick a case, read the walkthrough tasks, reset the demo |
| Family view | `#/family/demo-001`, `demo-002`, `demo-003` | Parents and guardians, on a phone or computer |
| Staff dashboard | `#/staff` (Maple Grove), `#/staff/cedar-park` (Cedar Park) | Waitlist, weekly capacity, clinic connections and family preview |

[Prototype V.0 notes](docs/prototype-v0.md) describe the original single-clinic demo and its peer-evaluation tasks.

## Try shared capacity

1. In Maple Grove’s staff dashboard, choose **Invite to connect**. Switch **Demo clinic** to Cedar Park and choose **Accept connection**.
2. Return to Maple Grove and preview the default proposal of two Cedar Park slots per week for three weeks. **Current estimate** stays at 6–10 weeks for `demo-001`, and **Scenario estimate** shows 5–9 weeks with the default capacity.
3. Choose **Send capacity proposal**. In Cedar Park, review the impact on its queue and choose **Confirm slots**. The family estimate at `#/family/demo-001` uses the confirmed schedule, and Cedar Park’s local availability reflects the commitment.
4. Choose **Cancel shared slots** to restore capacity. **Disconnect** stops summary sharing and withdraws pending proposals. Confirmed capacity remains until it is cancelled separately.

Both clinic roles use synthetic data and browser storage. The **Demo clinic** switcher illustrates how the two staff views differ. It is accessible from the same browser session.

## Build on it

1. Read the [wait-time definition and response contract](docs/wait-time.md).
2. The browser app uses the TypeScript data and connection logic in `backend/api` with [synthetic fixtures](data/demo/). The static build runs this logic in the browser.
3. The [estimator](backend/estimator/estimator.ts) models local capacity and confirmed shared slots by week. It applies travel limits to partner-site slots. Estimates are simulated and need validation before use with real clinic data.

Use synthetic data throughout the course prototype.
