# Team 12: viewing, suggesting and making changes

The [GitHub repository](https://github.com/aaustinmaa/team12-waitlist) holds the code. The [Thur-Team-12 team notebook](https://docs.google.com/document/d/11Euk5jO0elSPw9EsWZbbdWqb8sB7RWLwu1zwEFyLbCA/edit?tab=t.0) holds the project scope, design decisions and course records. If your AI tool can't open the Google Doc, paste in only the paragraphs it needs for the task.

> **Just want to see the prototype?** Open **https://aaustinmaa.github.io/team12-waitlist/** on your phone or laptop. You don't need to sign in, install anything or use AI. It shows the latest version merged into `main` and updates a few minutes after each merge.

## Pick your path

You don't need to code for the first three.

| You want to… | Do this | You need |
| --- | --- | --- |
| Try the prototype and give feedback | Open the live link and post your notes in Teams | Nothing |
| Fix some wording (labels, explanations, docs) | [Edit the file on GitHub](#fix-wording-on-github) | A GitHub account added to the repo |
| Try out an idea for a change | [Try it in Google AI Studio](#try-a-change-in-google-ai-studio), then share screenshots | A Google account |
| Make a change and submit it yourself | [Use Codex Desktop](#make-a-change-with-codex-desktop) | A GitHub account added to the repo, and Codex Desktop |

## How changes reach `main`

- `main` is the shared, reviewed version, and the live link always shows it.
- `main` is protected. Nobody can push to it directly. Every change goes through a **pull request (PR)** from its own branch.
- A PR can only be merged after Austin (the code owner) approves it. Approvals from other teammates don't unlock the merge, but comments are welcome.
- Use one branch and one PR per change. If you get feedback, update the same branch and the PR updates with it.

**First time only:** create a GitHub account if you don't have one, send Austin your username, and accept the email invitation to the repository. [GitHub's guide to invitations](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)

## Fix wording on GitHub

Best for small text changes. Everything happens in the browser.

1. Open the [repository](https://github.com/aaustinmaa/team12-waitlist) and find the file. Ask in Teams if you're not sure which one. Most wording on the family page is in `web/src/components/FamilyReferralView.tsx` and `web/src/lib/estimator.ts`.
2. Click the ✏️ pencil icon and make your edit. Only change the text between quotes or tags. Leave the code around it alone.
3. Click **Commit changes…**. Because `main` is protected, GitHub offers to **create a new branch and start a pull request**. Keep that option, give the branch a short name such as `jess-family-wording`, and click **Propose changes**.
4. Click **Create pull request**, then post the PR link in Teams.
5. GitHub runs the tests on your PR automatically. A green check means the app still builds. Austin reviews and merges it.

[GitHub's guide to editing files](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)

## Try a change in Google AI Studio

Use this to explore an idea and show it to the team. **Don't push from AI Studio.** Hand the result to someone who can submit it.

Why not push: AI Studio can sync with GitHub, but its documentation doesn't say which branch it pushes to. A push to `main` is refused because `main` is protected. Also, we haven't confirmed that AI Studio's Preview can run this project's folder layout (the app is in `web/` and reads data from `data/`). If it can't, Gemini should tell you so instead of rewriting the project.

1. Go to [Google AI Studio](https://aistudio.google.com/) and open **Build**.
2. In the prompt box, open the **+** menu and choose **Import from GitHub**. Pick `aaustinmaa/team12-waitlist`. [Google's Build mode guide](https://aistudio.google.com/docs/aistudio-build-mode)
3. Send Gemini this prompt, with your change filled in:

   ```text
   Read AGENTS.md and README.md in this repository first. I don't code, so explain
   everything in plain English.

   I'd like to try this change: [describe the change].
   I expect to see: [describe the result].

   Make the change and show it to me in Preview. Then list which files you changed
   and what you changed in each.
   Do not push or sync anything to GitHub. If the app can't run in Preview, tell me
   exactly what's missing instead of guessing or restructuring the project.
   ```

4. Check the result in **Preview**.
5. Post screenshots and Gemini's list of changed files in Teams. For a small text change, you can also copy it into a PR yourself by following [Fix wording on GitHub](#fix-wording-on-github). For anything bigger, use **Download** to save a ZIP and send it to Austin with a one-line description.

## Make a change with Codex Desktop

Codex runs the app on your own computer and can submit a PR for you.

1. **Open the project.** On the repository page, click **Code → Open with GitHub Desktop** to download it. Then add the downloaded `team12-waitlist` folder (the one with `README.md`) to Codex as a local project, and choose **This computer / Local** when you start a chat. [Cloning with GitHub Desktop](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-a-repository-from-github-to-github-desktop)
2. **Make and preview the change.** Send Codex this prompt:

   ```text
   Read AGENTS.md and README.md first. I don't code, so explain things in plain English.

   The change I want: [describe it in one sentence].
   What I expect to see: [describe the result].

   Keep any edits I already have. Fetch the latest origin/main from GitHub and start
   a new branch from it. If I gave you a link to an existing PR, keep working on that
   PR's branch instead.
   When you're done, start the app on this computer as the README describes, check
   the page, leave it running, and give me the exact localhost address and what to
   click. If something is missing and the app won't run, tell me exactly what.
   Let me look at the result before you commit anything.
   ```

3. Open the address Codex gives you (usually `http://localhost:5173`) and click through the change. `localhost` only works on the computer running the app.
4. **Submit it.** When you're happy, send:

   ```text
   I've checked the result. Commit only the files for this change, push the current
   branch, and open a draft pull request into main, or update the existing PR if there
   is one. In the PR, say what changed, how to preview it, and which checks you ran.
   Then give me the PR link.
   ```

5. If Codex says you're not signed in to GitHub or don't have permission, sign in with your own account and ask it to continue. If you're still stuck, post in Teams.
6. Open the PR, check it, and click **Ready for review**. Post the link in Teams for Austin.

## Review and merge

1. **Open the PR.** Check that **base** is `main` and **compare** is your branch. Make sure the description says what changed and how to check it. [Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
2. **Review.** Teammates look at **Files changed** and leave comments. The author fixes things on the same branch, then marks the PR **Ready for review**. [Changing the stage of a PR](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request)
3. **Merge.** Austin approves and merges once the checks are green. If there's a conflict, post the PR link in Teams and Austin will resolve it. [About merging PRs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)
4. **After the merge.** The live link updates within a few minutes. Start your next change from the latest `main`.

Use synthetic data only. Keep real patient information, private clinic exports, passwords and API keys out of the repository and out of AI chats.
