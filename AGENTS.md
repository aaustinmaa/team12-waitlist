# Working in Team 12 Waitlist

This repo is a course prototype for one fictional clinic and one milestone: the first speech-language assessment. The [Thur-Team-12 team notebook](https://docs.google.com/document/d/11Euk5jO0elSPw9EsWZbbdWqb8sB7RWLwu1zwEFyLbCA/edit?tab=t.0) records the project scope and design decisions. If you cannot open it, work from the repo and ask for relevant excerpts only if needed. Use synthetic referrals and capacity data. Keep the confirmed referral status separate from the estimated range. The family view must keep the status and clinic contact visible when an estimate is unavailable. See [the response contract](docs/wait-time.md) before changing a data shape or wait-time behavior.

## Help the teammate complete one task

1. Read [README.md](README.md), the [development guide](docs/team-onboarding.md), and the teammate's request. Explain progress in the teammate's language and use plain terms.
2. In a local checkout, confirm `origin` points to `aaustinmaa/team12-waitlist` and inspect `git status --short --branch`. Preserve existing edits, using a separate checkout or worktree where appropriate. For a new change, run `git fetch origin` and start a branch from `origin/main` with `git switch -c codex/<name>-<short-change> origin/main` (replace the placeholders). For review feedback, keep working on the existing PR branch. In Google AI Studio, verify the imported revision and use the branch or ZIP handoff in the development guide.
3. Keep the change scoped to the request. Keep real patient records, private clinic exports, tokens, and passwords out of the repo and AI chat.
4. Run the relevant checks. In Codex Local, use the repo's actual start commands, start any required backend, and verify the actual loopback URL before giving it to the teammate. Leave the dev processes running for their review if the environment allows it. In Google AI Studio use Build Preview and label it as a cloud preview. If the checked-out version has no runnable app or you're missing a dependency, give the exact blocker. Distinguish checks you ran from steps the teammate still needs to try.
5. When authorized to submit, stage only the changed files for this work, commit, push the current task branch (for example, `git push -u origin HEAD`), and open or update a **draft PR into `main`**. In AI Studio, use its Push action only if its target is explicitly confirmed as the task branch. Include the change and checks or preview steps using the [PR template](.github/pull_request_template.md). Return the PR link and what to review. If submission is blocked, return the files or patch, the preview result, and the next step in the development guide.

## Keep `main` reviewable

- Use one branch and PR per change. Check for an existing PR before opening one. Update that same PR when applying feedback.
- The teammate checks the result and marks the PR ready. The maintainer reviews and merges. Leave `main` updates to that review process. Avoid force pushes, history rewrites, and deleting or overwriting another contributor's work.
- If branches conflict, identify the affected files, preserve both contributors' work, and ask the maintainer to resolve any overlap that changes the intended behavior.
- GitHub `main` is the latest reviewed code. A local or cloud preview is for checking a version. Publishing a hosted demo is a separate action for the maintainer, as described in the [publishing guide](docs/demo-publishing.md).
