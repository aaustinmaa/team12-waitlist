# Team 12 开发流程

[GitHub 仓库](https://github.com/aaustinmaa/team12-waitlist)保存代码。[Thur-Team-12 团队笔记](https://docs.google.com/document/d/11Euk5jO0elSPw9EsWZbbdWqb8sB7RWLwu1zwEFyLbCA/edit?tab=t.0)保存项目范围、设计决定和课程记录。第一次先用自己的账号接受 GitHub 邀请，确认两个链接都能打开。AI 如果读不到 Google Doc，把这次开发需要的段落贴给它就可以。[GitHub 邀请协作者说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)

## 每次改动走这条路

| 你想做什么 | 到哪里做 |
| --- | --- |
| 看组里最新已合并的代码 | 打开 [GitHub 的 `main`](https://github.com/aaustinmaa/team12-waitlist/tree/main)。要看别人还在做的版本，打开对方的 PR。 |
| 开始一项改动 | 从最新的 `main` 开一个 branch，例如 `codex/yourname-change`。Branch 就是这次改动的工作副本。 |
| 看改完的网页 | Codex Desktop 用本机 localhost。Google AI Studio 用 Build 的 Preview。 |
| 把改动交给组里看 | Commit 保存改动，Push 上传到自己的分支，Draft PR 把改动和 `main` 并排给组里看。 |
| 让组员或老师打开一个网页链接 | 用已经获准的演示版本发布一个在线链接。详见[发布与分享](demo-publishing.md)。 |

组里共用一条 `main`。每项改动用一个分支和一个 PR。收到反馈就更新原分支，GitHub 会把后续提交加到同一个 PR。

## 用 Codex Desktop

1. **第一次打开。** 已经 clone 的话，把含有 `README.md` 的 `team12-waitlist` 文件夹加成 Codex 的本地项目。如果还没有本地副本，可在 GitHub 仓库点 **Code → Open with GitHub Desktop**，clone 后把保存的文件夹加到 Codex。开聊天时选 **This computer / Local**，这样 Codex 才能在你自己的电脑上启动网页。[GitHub 克隆指南](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-a-repository-from-github-to-github-desktop) · [Codex 运行环境](https://learn.chatgpt.com/docs/environments/modes)
2. **开分支并看网页。** 把下面的提示词给 Codex。它会查看是否有未保存的改动，从 GitHub 拿最新代码，开分支，再按项目实际的启动命令运行。网页启动后，请它把终端显示的完整地址给你，在 Codex 的内置浏览器或自己电脑的浏览器打开。只想看最新版本时，告诉 Codex「保留我现在的改动，用最新 `origin/main` 的干净副本预览并告诉我 commit」。[Codex 本地预览](https://learn.chatgpt.com/docs/browser#preview-a-page)
3. **提交。** 你点过预览、确认结果后，把第二段提示词发给 Codex。它可以用 Git 或桌面 Git 控件提交、推送和开 PR。如果它说 GitHub 登录或权限不足，用自己的账号完成登录，再让它继续；也可以在 GitHub 上从已推送的分支开 PR。[Codex 的 Git 控件](https://learn.chatgpt.com/docs/environments/local-environment#use-built-in-git-tools)

~~~text
请先读 AGENTS.md 和 README.md。我要改的是：[用一句话描述]。
我希望看到：[完成后应该怎样]。

请保留我已有的改动，fetch GitHub 最新的 origin/main，从那里开新分支。
如果我给了已有的 PR 链接，就继续用那个 PR 的分支。
完成后，请用本机终端按项目现有说明启动需要的开发服务，验证网页，
保持服务运行，给我实际的 localhost 地址和需要点击的地方。
如果这个版本还没有可运行的应用或缺依赖，请直接告诉我具体缺什么。
先让我看结果。
~~~

~~~text
我看过结果了。请只提交本次相关文件，push 到现在的分支，
然后向 main 创建 draft PR；如果已有 PR，就更新它。
在 PR 里写清改了什么、怎么预览、你跑过什么检查。
请把 PR 链接发给我，留给维护者 review 和 merge。
~~~

`localhost` 只在启动服务的那台电脑上打开。关闭服务后，叫 Codex 重新启动就行。目前仓库只有 scaffold，所以启动方式和端口要等真正的应用加入后才能确认。

## 用网页版 Google AI Studio

1. **拿最新代码。** 在 AI Studio 进入 **Build**，从输入框的 **+ → Import from GitHub** 导入团队仓库，用有权限的 GitHub 账号授权。已有 Build 项目可在 **Settings → GitHub** 检查绑定并 Pull 更新。先到 GitHub 确认要用的是最新 `main` 或你正在继续的分支。如果 AI Studio 里有未推送的改动，先用 **Download / ZIP** 留一份，再同步。第一次导入后让 Gemini 读 `AGENTS.md` 和 `README.md`。[Google AI Studio Build 和 GitHub 同步](https://ai.google.dev/gemini-api/docs/aistudio-build-mode?platform=android)
2. **开分支。** 在 GitHub 仓库选 `main`，点文件上方的分支下拉菜单，输入 `codex/yourname-change`，选 **Create branch**。只有当 AI Studio 明确显示已切到这个分支、且 Push 的目标也是这个分支时，才直接从 AI Studio Push。[GitHub 网页建分支](https://docs.github.com/en/pull-requests/how-tos/commit-changes/managing-branches-within-your-repository)
3. **预览并交回代码。** 用 **Build → Preview** 检查改动。网页端的 Preview 跑在 Google 的环境。如果需要在自己电脑上开 localhost，下载 ZIP 后，用能运行本机终端的工具（如 Codex Desktop）打开代码并启动。若 AI Studio 无法确认推送分支，按下面的方式提交。[Google AI Studio 的预览与 ZIP 导出](https://ai.google.dev/gemini-api/docs/aistudio-build-mode?platform=android)

**AI Studio 无法指定推送分支时**

- 少量文件：在 AI Studio 的 **Code** 里找到实际改过的文件。在 GitHub 切到自己的分支，打开同路径的文件，点铅笔、贴上新内容，再点 **Commit changes**。这是直接在 GitHub 分支保存，提交后可以开 PR。[GitHub 网页编辑文件](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)
- 多个文件或改了项目结构：从 AI Studio 下载 ZIP，连同改动说明、预览结果、起始 GitHub 分支或 commit 交给能用本机 Git 的组员。让她的 AI 比对并把本次改动带到任务分支，再跑检查和开 PR。ZIP 是交接材料，PR 只包含核对过的改动。

~~~text
请先读导入仓库里的 AGENTS.md 和 README.md。
我想改的是：[描述改动]。我希望看到：[描述结果]。
请在 Build 的 Preview 里验证，列出改过的文件和检查步骤。
告诉我现在绑定的 GitHub 仓库和分支。如果你无法确认是
我自己的分支，请留在 Preview，并告诉我需要导出或复制哪些文件。
~~~

## 在 GitHub 审阅和合并

1. **开 PR。** 分支提交到 GitHub 后，点 **Compare & pull request**，或进入 **Pull requests → New pull request**。确认 **base = main**、**compare = 你自己的分支**，然后选 **Create draft pull request**。填好改了什么、怎么验收。[GitHub 开 PR 指南](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request)
2. **Review。** 打开 **Files changed**，照描述里的步骤检查。有反馈就在原分支修改并再次 Push。作者确认后点 **Ready for review**，把 PR 链接交给维护者。[GitHub 草稿 PR 指南](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/changing-the-stage-of-a-pull-request)
3. **Merge。** 维护者核对 base 是 `main`、改动和检查都符合预期后，在 PR 底部选择仓库允许的合并方式，例如 **Squash and merge**，然后确认。遇到冲突，先把文件和冲突发给维护者，在原分支同步和复查后再合并。[GitHub 合并说明](https://docs.github.com/en/pull-requests/reference/pull-request-merges)
4. **继续开发。** 回 GitHub 的 `main` 看最新版本。下一次让 Codex fetch 后从新 `origin/main` 开分支，或在 AI Studio 里保存手头工作后 Pull 或重新导入最新版本。分享给别人的旧预览链接是否需要更新，按[发布与分享](demo-publishing.md)确认。

## English quick start

Read the [team notebook](https://docs.google.com/document/d/11Euk5jO0elSPw9EsWZbbdWqb8sB7RWLwu1zwEFyLbCA/edit?tab=t.0) and get the latest code from GitHub `main`. Start a branch from it for each change. In **Codex Desktop**, open your local clone, use **This computer**, and ask Codex to run the app and give you its localhost URL. In **Google AI Studio**, import the repo in **Build** and use **Preview**. Push only if your own branch is confirmed as the destination. Otherwise export the changed files and commit them on your branch on GitHub, or ask a teammate to apply them locally.

~~~text
Read AGENTS.md and README.md. I want to change [describe the change].
I expect to see [describe the result]. Start from the latest main on my own
branch and show me the local or Build preview. List the files you changed
and how I can check the result. Wait for me to review the preview before
committing, pushing my branch, and opening a draft PR into main.
~~~

After you check the result, ask your AI to submit the branch, or open the draft PR on GitHub yourself. The maintainer merges after review. Publish a shareable demo only when someone needs to open it outside your development session. See [the publishing guide](demo-publishing.md).
