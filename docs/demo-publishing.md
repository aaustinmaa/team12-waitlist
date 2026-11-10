# Previewing, sharing and publishing the demo

While you work on a change, check it yourself on **localhost** or in your tool's **Preview**. When teammates need to see the code or give feedback, share the **GitHub PR**. When the instructors or test users need to open a web address and try it themselves, share the **live demo**. Note the branch or commit behind any shared link in the PR or the team notebook, so everyone knows which version people saw.

## The live demo

**https://aaustinmaa.github.io/team12-waitlist/**

- [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) publishes it automatically. On every merge into `main`, GitHub Actions runs the tests, builds the app and publishes it to GitHub Pages, usually within a few minutes.
- If the tests or the build fail, nothing is published and the link keeps showing the last working version. The repository's **Actions** tab shows which commit each run published.
- Pull requests run the same tests and build but don't publish.
- The link is public, so it must only ever contain synthetic data.

## Other ways to publish

Use these only when you need a version other than GitHub Pages, for example a separate link for a branch that hasn't been merged yet.

| Platform | When to use it | How |
| --- | --- | --- |
| Google AI Studio | The prototype already runs in Build and someone needs an online copy. | Click through the main flows in **Preview**. **Share** shares it inside AI Studio, so check that the recipient's account can open it. For a standalone site, the maintainer clicks **Publish** in Build, follows the prompts to choose a Google Cloud project or another available option, and tests the Cloud Run link it creates. Publishing may be limited by account, quota or cost. [Google's publishing guide](https://aistudio.google.com/docs/aistudio-deploying) |
| Claude on the web | You only need a single page or interactive demo that runs inside Claude. | Ask Claude to build an Artifact from the confirmed code. Try it in the Artifact, then use **Share** to set who can see it. Older Artifacts may show **Publish** or **Share & copy link**. Use the options your account shows, and check whether recipients need to sign in. [Sharing Claude Artifacts](https://support.claude.com/en/articles/9547008-share-artifacts) |
| ChatGPT / Codex | Your account has **Sites** and the project is compatible. | In ChatGPT or Codex, use **Sites** to prepare a site from the confirmed local version, then save and preview it. After the maintainer confirms, deploy that version and choose the audience in the Sites sharing settings. Check that recipients can open the deployed link. [Creating a site](https://learn.chatgpt.com/docs/sites/creating-a-site) · [Publishing and sharing Sites](https://learn.chatgpt.com/docs/sites/publishing-and-sharing) |

**Team default:** review the PR, the maintainer merges it, and the course demo is published from that `main` commit. To show teammates a branch early, share its PR and preview and label it as a draft. One platform that runs the demo is enough.

Before publishing anything else, the maintainer checks three things:

1. The demo uses synthetic data. Real patient records, private clinic exports, Google Doc contents and keys stay where they're controlled.
2. Open the URL the way the recipient will, and confirm access, both main screens and any backend it needs all work. In-platform share links, public sites and localhost addresses reach different people.
3. Record the link, its commit and the intended audience in the team notebook. Code tried out on a platform only becomes the starting point for the next change after it goes through a GitHub branch and PR.

If you want to hand this to an AI in one go:

~~~text
Prepare a demo preview from the confirmed GitHub version. Tell me which commit you
used, how to preview it, who will be able to open it once published, and what you
checked. Show me the preview and publishing options first; the maintainer decides
which version to publish and for which audience.
~~~
