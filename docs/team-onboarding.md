# 用 AI 参加 Team 12 原型开发

你负责说明想做什么，以及看结果是否符合预期。AI 可以在任务分支里改文件、检查改动，再把它整理成一个草稿 PR 交给组里 review。

## 第一次参加

1. 登录你自己的 GitHub 账号，接受仓库维护者发的邀请。确认你能打开 [Team 12 Waitlist](https://github.com/aaustinmaa/team12-waitlist)。如果看不到，先确认登录的是受邀的账号。
2. 在能编辑 GitHub 仓库的 AI 工具里打开 `aaustinmaa/team12-waitlist`。用本地 AI 编辑器时，先用它的 **Clone repository** 或 **Open folder** 打开这个仓库的本地副本。普通聊天工具如果只能给你回复文字，可以让它帮你准备内容，再请维护者帮你提交。
3. 从组里领一个小任务。发给 AI 的内容只需要说明 **要改什么**、**完成后应该看到什么**，以及 **Issue 链接或编号**（如果有）。

## 每个任务都可以复制这段给 AI

```text
我第一次参与这个仓库的开发，请用中文解释我需要做的事。
仓库是 aaustinmaa/team12-waitlist。先读根目录的 AGENTS.md 和 README.md。

我的任务：[粘贴 Issue 链接，或用一句话写你要做的改动]
完成标准：[写你想看到的结果。Issue 已写清楚的话，可填“按 Issue”]

请按 AGENTS.md 检查仓库、创建任务分支、完成改动并验证结果。
我授权你提交并推送本任务分支，然后向 main 开一个草稿 PR。
如果这个任务已经有 PR，继续在同一个分支上更新。
最后给我 PR 链接、你验证了什么，以及我怎么确认改动符合预期。
如果你没有仓库、终端或 GitHub 写权限，告诉我卡在哪一步，
并交付能完成的内容，方便我找维护者接手。由维护者 review 和合并。
```

## AI 做完之后

1. **打开草稿 PR。** 文案或文档看 **Files changed**。网页功能按 AI 提供的预览或操作步骤点一遍。比如，找不到估算时，家长应该仍能看到等候状态和联系方法。
2. **有地方要改，就把 PR 链接和具体反馈发给同一个 AI。** 例如「`Estimate unavailable` 下方加一句：孩子仍在等候首次评估。请更新这个 PR。」改完继续看同一个链接。
3. **确认后点 Ready for review，并把 PR 链接发给维护者。** 维护者看改动、确认验收结果，再合并。领下一项任务时，用最新的 `main` 开新分支，这一步也可以交给 AI。

| GitHub 上看到的词 | 它在这个项目里是什么意思 |
| --- | --- |
| `main` | 组里已经审阅并合并的版本 |
| Branch / 分支 | 这项任务自己的工作副本 |
| Commit / Push | 在分支上保存一次改动，再上传到 GitHub |
| Draft PR / 草稿 PR | 一条可预览、可继续修改的链接 |
| Review / Merge | 维护者检查改动，再把它加进 `main` |

## 可以从这两项开始

目前 `web/` 只有目录。下面两项现在就能并行做，写好后会直接用于原型和走查。

| 任务 | 完成标准 |
| --- | --- |
| 家长页面文案（建议 `docs/family-copy.md`） | 给有估算和暂时无估算两种情况各写一组简短英文文案。两种情况都保留转介状态。说明预计等到首次评估，并给出下一步。参考 [`data/demo/`](../data/demo/) 的合成案例。 |
| 试用场景（建议 `docs/demo-walkthrough.md`） | 写两张英文任务卡和各自的验收标准。一张看家长能否说清预计还要等多久、等到什么，另一张看无估算时能否找到当前状态和联系方法。任务卡让试用者自行找入口。 |

网页框架合并后，可以分别认领 **家长的估算卡片** 和 **诊所的预约容量控件**。维护者负责先搭好共享页面入口，并在任务里写清各自改哪些文件、怎么验收。

## 给维护者

在仓库 **Settings → Collaborators → Add people** 里邀请队友自己的 GitHub 账号，等她们接受后发这份指南。每项任务给一个人，写清要交付的内容和验收标准。Review 时打开 **Files changed**，按 PR 的步骤检查结果，再由维护者合并。首次收到 PR 的队友也可以用同样的步骤跟你一起看改动。[GitHub 的协作者邀请步骤](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)

## English quick start

Accept the GitHub invitation, then open `aaustinmaa/team12-waitlist` in an AI coding tool that can edit your checkout or the connected GitHub repo. Pick one task. Paste the prompt below, open the resulting draft PR, and check the result using the preview or the **Files changed** tab. Send any edits back to the same AI chat with the PR link. When you're satisfied, click **Ready for review** and send the link to the maintainer, who reviews and merges it. [GitHub's draft PR guide](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/changing-the-stage-of-a-pull-request)

```text
I'm new to coding. Read AGENTS.md and README.md in aaustinmaa/team12-waitlist.
My task is [paste issue link or describe the change].
It's done when [describe what I should see or say “use the issue criteria”].
Follow AGENTS.md. You may commit and push the task branch and open a draft PR into
main. If there's already a PR for this task, update it. Give me the PR link, what
you checked, and simple steps for me to verify the result. If you can't access
the repo or submit the PR, explain the blocker and give me the work you completed.
The maintainer will review and merge.
```
