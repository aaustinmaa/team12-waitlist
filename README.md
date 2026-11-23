# Early Birds Waitlist

Early Birds is CS 497 Thursday Team 12. It gives families waiting for non-urgent children's developmental services (speech-language first) a wait range they can trust. Each range is learned from the clinic's own data and checked against what really happened.

Prototype V.1 is two apps on one engine: a **family app**, where families sign in with a one-time code, and a **clinic portal** for staff, where each clinic imports exports from its own system. See [docs/platform.md](docs/platform.md) for how it fits together.

| Path | What belongs here |
| --- | --- |
| [`web/src/engine/`](web/src/engine/) | The wait-time estimator: fit, back-test and calibration, simulation |
| [`web/src/ingest/`](web/src/ingest/) | Importing any clinic export: profiling, AI or rule-based column mapping, validation |
| [`web/src/apps/`](web/src/apps/) | The family app and the clinic portal |
| [`data/samples/`](data/samples/) | Synthetic exports from three fictional clinics, in three formats |
| [`supabase/`](supabase/) | Hosted version: schema with row-level security, AI mapping function |
| [`docs/`](docs/) | Platform overview, wait-time definition and response contract |

## See the prototype

**[Open the live demo](https://aaustinmaa.github.io/team12-waitlist/)**. It works on a phone or a computer. The two apps have separate addresses: the family app at `/` and the clinic portal at `/clinic/`. `/demo/` has both QR codes, the demo accounts and a walkthrough. Every referral is synthetic.

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

Open the address Vite prints. `npm test` runs the engine, import and app tests on the sample exports. `npm run build` makes a static copy in `web/dist/`.

| App | Path | Who it is for |
| --- | --- | --- |
| Family app | `/` | Parents and guardians, phone first. Sign in with a one-time code. |
| Clinic portal | `/clinic/` | Clinic staff: waitlist, reports, data imports, how estimates are made, settings, audit log |
| Demo guide | `/demo/` | Demo Day: both QR codes, accounts and a walkthrough. Not linked from either app. |

To regenerate the sample exports: `node data/samples/generate.mjs`.

Use synthetic data throughout the course prototype.
