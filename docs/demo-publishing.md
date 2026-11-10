# 演示链接怎么预览、分享和发布

平时改代码时，用 **localhost** 或工具的 **Preview** 自己验收。组员要看代码或给反馈时，发 **GitHub PR**。老师或试用者需要打开一个网址亲自操作时，再准备**在线演示**。把线上演示对应的 GitHub 分支或 commit 记在 PR 或团队笔记里，方便确认别人看到的是哪一版。

## 现在的在线演示

**https://aaustinmaa.github.io/team12-waitlist/**

- 由 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) 自动发布：每次合并进 `main`，GitHub Actions 会先跑测试、再 build，最后发布到 GitHub Pages，通常几分钟内更新。
- 发布前测试或 build 失败就不会更新，链接继续显示上一个能用的版本。在仓库的 **Actions** 页能看到每次发布对应的 commit。
- PR 上也会跑同样的测试和 build，但不会发布。
- 链接是公开的，谁都能打开，所以里面只放合成数据。

## 其他发布方式

只有在需要 GitHub Pages 以外的版本时才用下面这些，比如给某条还没合并的分支单独发一个链接。

| 平台 | 什么时候用 | 怎么操作 |
| --- | --- | --- |
| Google AI Studio | 原型已经在 Build 中运行，且需要别人打开在线版。 | 在 **Preview** 点完主要流程。可用 **Share** 做平台内分享，按接收者账号验证权限。需要独立站点时，维护者在 Build 点 **Publish**，按提示选 Google Cloud 项目或可用的发布选项，完成后打开生成的 Cloud Run 链接测试。发布可能受账号、额度或费用限制。[Google 发布说明](https://ai.google.dev/gemini-api/docs/aistudio-deploying?authuser=1) |
| Claude 网页版 | 只需要一个在 Claude 里运行的独立页面或互动演示。 | 让 Claude 从确认过的代码做一个 Artifact。先在 Artifact 里试一遍，再用 **Share** 设访问范围。旧版 Artifact 可能显示 **Publish** 或 **Share & copy link**。按账号实际选项操作，并检查接收者是否需要登录。[Claude Artifact 分享说明](https://support.claude.com/en/articles/9547008-share-artifacts) |
| ChatGPT / Codex | 账号有 **Sites**，而且要把可兼容的项目做成一个可分享网站。 | 在 ChatGPT 或 Codex 里用 **Sites** 从确认过的本地版本准备网站，先保存并预览。维护者确认后部署该版本，再在 Sites 的分享设置里选择受众。确认接收者能打开部署后的链接。[创建 Sites 网站](https://learn.chatgpt.com/docs/sites/creating-a-site) · [Sites 发布和分享](https://learn.chatgpt.com/docs/sites/publishing-and-sharing) |

**组内默认流程：** 先验收 PR，由维护者合并，再从确定的 `main` commit 发布一份课程演示。如果只是给组员先看某条分支，用对应的 PR 和预览，并注明是草稿。选一个能跑通演示的平台就够了。

发布前，维护者核对三件事：

1. 演示里使用合成数据。真实患者资料、私有临床导出、Google Doc 内容和密钥保留在各自的受控位置。
2. 用接收者的视角打开 URL，确认访问权限、两个主要界面和所需后端都正常。平台内的分享链接、公开网站和本机地址的访问范围不同。
3. 在团队笔记里记录链接、对应 commit 和预期受众。平台里试出来的代码要经过 GitHub 分支和 PR，才能成为组里下次开发的起点。

如果需要给 AI 一句话，可以发：

~~~text
请用已确认的 GitHub 版本准备一个演示预览。告诉我使用的 commit、
预览方式、发布后谁能访问，以及你检查了什么。
先给我预览和发布选项，由维护者决定用哪个版本、哪个受众发布。
~~~
