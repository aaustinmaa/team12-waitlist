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

- [Thur-Team-12 team notebook](https://docs.google.com/document/d/11Euk5jO0elSPw9EsWZbbdWqb8sB7RWLwu1zwEFyLbCA/edit?tab=t.0) for project scope, design decisions, and course records.
- [Development guide](docs/team-onboarding.md) for getting the latest code, previewing, and contributing from Codex Desktop or Google AI Studio.
- [Publishing guide](docs/demo-publishing.md) for sharing an approved online demo. AI coding assistants should read [AGENTS.md](AGENTS.md) before editing.

## Run the prototype

You need Node.js 20 or newer.

```bash
cd web
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). `npm test` checks the family responses against the contract fixtures, and `npm run build` makes a static copy in `web/dist/` that any static host can serve.

| Page | Path | Who it is for |
| --- | --- | --- |
| Demo home | `#/` | Facilitators: pick a case, read the walkthrough tasks, reset the demo |
| Family view | `#/family/demo-001`, `demo-002`, `demo-003` | Parents and guardians, on a phone or computer |
| Staff dashboard | `#/staff` | Clinic intake team: waitlist, weekly capacity, family preview |

[Prototype V.0 notes](docs/prototype-v0.md) cover what the prototype shows, how the simulated estimate works, and the peer-evaluation tasks.

## Build on it

1. Read the [wait-time definition and response contract](docs/wait-time.md).
2. The browser app reads [synthetic data](data/demo/) through `web/src/lib/api.ts`. When `backend/api` exists, swap those functions for API calls that return the same shapes.
3. `web/src/lib/estimator.ts` is a simulation stand-in. The real estimator belongs in `backend/estimator` and needs to handle referrals that are still waiting.

Use synthetic data throughout the course prototype.
