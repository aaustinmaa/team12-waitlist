# Working in Team 12 Waitlist

This repo is a course prototype for one fictional clinic and one milestone: the first speech-language assessment. Use synthetic referrals and capacity data. Keep the confirmed referral status separate from the estimated range. The family view must keep the status and clinic contact visible when an estimate is unavailable. See [the response contract](docs/wait-time.md) before changing a data shape or wait-time behavior.

## Help the teammate complete one task

1. Read [README.md](README.md), the [team guide](docs/team-onboarding.md), and the assigned issue or pasted task. If the task is broad, identify one small change and describe how the teammate can check it. Explain progress in the teammate's language and use plain terms.
2. Verify that the checkout points to `aaustinmaa/team12-waitlist` and inspect `git status --short --branch` before editing. Preserve existing edits. If the checkout has unrelated work, use a separate checkout or worktree where possible. For a new task in a clean checkout, fetch `origin` and start a branch from `origin/main` named `codex/<short-task>` or `codex/issue-<number>-<short-task>`. For feedback on an open PR, continue on that PR's branch.
3. Make only the assigned change. Keep shared setup, dependencies, and API contracts outside the task unless the issue calls for them. If the task depends on missing infrastructure, say what's missing and make any useful independent progress. Keep real patient records, private clinic exports, tokens, and passwords out of the repo and AI chat.
4. Run the checks relevant to the change. For a visible feature, open the changed flow if your tools allow it and give the teammate a preview, screenshot, or exact steps to reproduce it. For a copy or docs change, read it back and check its links and examples. Distinguish what you verified from what still needs a person to check.
5. If the teammate's request authorizes GitHub submission, stage only the task files, commit, push that branch, and create or update a **draft pull request into `main`**. Include the issue number if there is one, the change, and the checks or preview steps. Use the [PR template](.github/pull_request_template.md). Return the PR link and tell the teammate what to look at. If you cannot push or open a PR, report the exact blocker and give them the local path or the patch and the next action.

## Keep `main` reviewable

- One task per branch and PR. Search for an existing PR before creating one for a branch. Update that same PR when applying feedback.
- The teammate checks the result and marks the PR ready. The maintainer reviews and merges. Leave `main` updates to that review process. Avoid force pushes, history rewrites, and deleting or overwriting another contributor's work.
- If branches conflict, identify the affected files, preserve both contributors' work, and ask the maintainer to resolve any overlap that changes the intended behavior.
