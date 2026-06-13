# sandbank.dev 设计要素分析

> 基于仓库真实代码整理（`index.html`、`package.json`、`vite.config.ts`、`src/`、`workers/`）。本仓库没有 README 或既有设计文档，以下结论全部来自源码本身。

## 仓库内的 App / Package 构成

| 模块 | 路径 | 形态 | 是否有 UI |
| --- | --- | --- | --- |
| sandbank.dev 官网 + 控制台 | `src/`（Vite + React 19 SPA） | Web App | 有 |
| Sandbank API Worker | `workers/api/`（Cloudflare Worker + D1） | 后端 API（租户鉴权 / 调度路由） | 无 UI |

仓库中没有 React Native、Expo、Flutter、Swift/Kotlin 等任何 Native 工程痕迹。

---

# 一、Web App（`src/`，Vite + React 19 SPA）

## 1. 项目定位

- **产品**：Sandbank——面向 AI Agent 的统一沙箱 SDK（开源，MIT，v0.2.0）及其托管云服务 Sandbank Cloud。`index.html` 的 title/description 直接点题："Unified Sandbox SDK for AI Agents — Write once, run on any cloud"。
- **站点职责**：三合一——SDK 营销/文档首页（`/`）、Sandbank Cloud 产品页（`/cloud`）、租户控制台（`/panel/*`）。
- **目标受众**：构建 AI Agent 的开发者，以及 AI Agent 本身（`/cloud` 页面专门提供"把这一行加进 Agent 提示词"的自主接入入口 `Read https://api.sandbank.dev/skill.md ...`）。
- **技术栈**：React 19 + react-router 7 + Tailwind CSS 4（`@theme` token 方案）+ shiki（代码高亮）+ Clerk（控制台鉴权，dark 主题定制）。

## 2. 产品 / 信息架构

路由定义在 `src/main.tsx`，仅三条：

```
/            首页：SDK 价值主张 → Quick Start → Adapters 对比 → Provider 热切换
             → Capability Detection → Service Layer (DB9) → Multi-Agent → Agent Client
             → Packages 安装清单 → Footer
/cloud       云产品页：Hero（速度/价格双指标）→ AI Agents 自主接入 → Pricing → Resource
             Limits → Default Image (codebox) → Browser 自动化 → DB9 → Features →
             Quick Start (curl) → TypeScript SDK → Webhooks → API Reference → Port
             Forwarding → Footer（含实时服务状态）
/panel/*     控制台（Clerk SignedIn/SignedOut 分流）：overview / boxes / relay /
             billing / api-keys / webhooks / project-settings 七个子区，由
             sectionFromPath 解析路径切换
```

- 营销页（`/`、`/cloud`）是**单页长滚动 + 锚点导航**结构，每个区块以小型 mono 眉题（uppercase tracking 标签）开头，信息粒度从"是什么"递进到"怎么用"（代码示例占主导）。
- 控制台是经典 **header + 侧边导航 + 内容区**的 SaaS 仪表盘结构；数据层级为 租户 → 项目（含节点/区域归属）→ 沙盒（box）/ API Key / Relay 关系 / Webhook，项目维度通过 header 中的 ProjectSwitcher 切换并持久化在 `localStorage`。
- 无项目时有独立的 onboarding 页（左侧三卡片解释 Project / API Key / Relay 概念，右侧创建表单）。

## 3. 视觉语言

基础设计 token 集中在 `src/index.css` 的 Tailwind `@theme`，营销页与代码块默认使用这套 sandbank 主题；控制台再通过 `.panel-shell` 覆盖为另一套 nullframe 风格 token：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-surface` | `#151516` | 全局深色背景 |
| `--color-surface-raised` | `#202024` | 卡片 / 代码块底色 |
| `--color-sand-400` | `#D4A853`（沙金色） | 唯一品牌强调色：链接、价格、激活态、ASCII 波浪 |
| `--color-text-primary/secondary/muted` | `#F3F0E8 / #C5BDAF / #A0988B` | 三级暖灰文字 |
| `--color-border` | `rgba(212,168,83,0.16)` | 边框统一为低透明度沙金 |
| `.panel-shell --color-surface` | `#000000` | 控制台黑色底色 |
| `.panel-shell --color-sand-400` / `--panel-orange` | `#f26522` | 控制台主强调色（nullframe 橙） |
| `.panel-shell --panel-red/green` | `#d71921 / #4a9e5c` | 控制台危险/成功语义色 |

- **配色哲学**：营销页是近黑底 + 单一暖沙金，呼应 "Sandbank（沙洲）" 命名；功能色极少且低饱和（emerald 表示在线/免费/优点，red 表示错误/DELETE，blue 仅用于 PUT 方法标签）。控制台已经切到 nullframe 语言：纯黑底、低亮度灰面、橙色主强调、红/绿状态色，并在背景上叠加 16px 点阵噪声。
- **字体**：营销页正文 Inter（Google Fonts 仅加载 300/400/500 三个字重），代码与标签/元信息用系统 mono 栈。控制台 `.panel-shell` 改用 Space Grotesk 作为界面字体、Space Mono 作为代码/等宽字体，并预留 Doto 用于数字/系统标签。**mono 字体的使用比例仍然很高**——导航、眉题、按钮、表格、说明文字全部是 mono 小字号 + uppercase + 宽字距（`tracking-[0.1em]~[0.15em]`），构成强烈的"终端/基础设施"气质。
- **标志性视觉**：`AsciiCanvas`（`src/components/ascii-canvas.tsx`）——Canvas 实时渲染的 ASCII 海浪，分四层深度（泡沫字符 `.:·°*` → 波浪字符 `~≈∽∿` → 密度字符 → 深渊噪点），固定在 Hero 底部 45% 高度，沙金色低透明度绘制；鼠标 120px 半径内字符变成高亮的 `0/1` 二进制——把"沙箱/海"主题和"代码"主题揉在一个交互彩蛋里。
- **圆角策略**：营销页用 `rounded-full` 按钮、`rounded-xl/2xl` 卡片；控制台 nullframe 层不是全直角，而是混合使用 8px 按钮、12px 卡片/代码块、14px 下拉菜单、`rounded-full` 图标按钮。Clerk 登录组件通过 `clerkAppearance`（`src/main.tsx`）改成黑底 + 橙色主色 + 16px 圆角，与控制台新风格保持接近。

## 4. 布局与导航

- **营销页**：Hero 占满 `h-screen`（nav 顶部 + 内容垂直居中 + ASCII 波浪垫底 + "Scroll ↓" 提示）；正文收窄到 `max-w-3xl` 单列，区块间距统一 `py-24`，列表型内容（Adapters、Pricing、API Reference、Packages）一律用 **上边框分隔的行式列表**（`border-t border-sand-400/10`）而非表格控件。
- **首页导航**只有 Cloud / Docs（锚点）/ GitHub / 语言切换四项；**Cloud 页**桌面端展示六个锚点（Agent/Browser/DB9/Pricing/Webhooks/API），移动端折叠进自绘汉堡 `MobileMenu`（三条线动画变 ×，点击外部关闭，平滑滚动到锚点并 `history.replaceState`）。
- **控制台**：`PanelFrame` 外层套 `.panel-shell`，用 nullframe 黑/橙 token、点阵背景与 sticky 顶栏（logo + ProjectSwitcher + Billing 图标 + Clerk UserButton）。内容区 `lg:grid-cols-[16rem_1fr]`——桌面侧栏垂直导航，小屏退化为顶部横向滚动的 tab 条；侧栏底部固定语言切换器。导航图标是内联手绘 SVG（`PanelSvgIcon` 系列，24px stroke 风格）。

## 5. 交互模式

- **i18n 全局机制**：`src/i18n.ts` 自实现的 store（`useSyncExternalStore` 订阅），EN/中文/日文三语全量翻译（含 Clerk 文案深度覆盖，见 `src/lib/clerk.ts` 的 mergeLocalization），语言偏好持久化。
- **链接动效**：`.link-underline`——下划线从右收起、从左展开的 `scaleX` 过渡（0.4s 自定义 cubic-bezier），是营销页唯一的"精致动效"。其余 hover 均为 180ms 颜色过渡。
- **实时反馈**：Cloud 页脚 `StatusBadge` 每 30s 轮询 `api.sandbank.dev/health`，绿点 `animate-pulse` 表示在线；CopyButton 复制后 2s 内显示 "Copied!"。
- **控制台数据流**：Clerk token → `authedFetch` → `/v1/panel/*`；bootstrap/summary/boxes/billing/webhook 并行拉取，统一 loading/error state；错误经 `panelApiErrorMessage` 映射为本地化文案，显示在红色横幅。
- **关键安全交互**：新 API Key 以 `SecretBanner` 一次性展示（"现在复制，之后不会再次显示"）；删除项目需输入项目名确认；webhook secret/token 已配置时显示"输入新值可轮换"占位符。
- **Relay 画布**：panel 内有可拖拽平移的关系画布（PointerEvent 实现 pan，`dragRef` 记录起点），节点分 project/functional/public-node/empty 四类，边分 live/available 两态——是控制台中交互最重的自绘组件。
- 下拉组件（ProjectSwitcher、PanelLanguageSwitcher、MobileMenu）均为自绘：点击外部关闭 + Escape 关闭，无第三方组件库。

## 6. 内容语气

- **英文文案**是简短宣言式短句，常以句号断开制造节奏："One TypeScript interface. Five cloud providers. Zero vendor lock-in."、"$0.02 per sandbox. That's it."；技术参数毫不回避地直接示人（KVM、Firecracker、eip155:8453、HMAC header 名）。
- **中文/日文翻译**不是机翻腔，做了本地化取舍（如中文把 box 译为"沙盒"、控制台语境用"发放 Key / 流水 / 充值"；日文 Panel 区保留 "Box" 外来语）。
- 面向两类读者写作：给人看的营销短句 + 给 Agent 看的可执行指令（skill.md 一行接入、curl/TS 代码块）。
- 品牌名一律小写 `sandbank`，配合 mono 字体强化 CLI 气质。

## 7. 关键组件

| 组件 | 位置 | 要点 |
| --- | --- | --- |
| `AsciiCanvas` | `src/components/ascii-canvas.tsx` | 品牌 Hero 动画：多层正弦波 ASCII 海浪 + 鼠标二进制扰动，DPR 适配，rAF 驱动 |
| `CodeBlock` | `src/components/code-block.tsx` | shiki `vitesse-dark` 异步高亮，文件名作为浮动标签嵌在边框上（`absolute -top-3` + 背景色遮挡边框的"剪口"手法），高亮前有同构 fallback |
| `LangSwitcher` | home/cloud 内联 | EN/中/日 三按钮极简切换 |
| `PanelHeader` + `ProjectSwitcher` | `src/pages/panel.tsx` | sticky 顶栏；项目下拉含列表（节点/区域徽标）+ 内嵌创建表单 |
| `PanelNav` | `src/pages/panel.tsx` | 响应式侧栏/横向 tab 双形态，内联 SVG 图标 |
| `RelayCanvas` 系列 | `src/pages/panel.tsx` | 可平移关系画布 + 功能沙盒/公开节点目录（WeChat Box、Logbox、Browserbox、Mailsbox、Runnerbox…） |
| `StatusBadge` / `CopyButton` / `SecretBanner` | cloud/panel | 轮询健康状态、剪贴板反馈、一次性密钥展示 |
| `panel-button-primary/secondary` | `src/index.css` | 控制台按钮基类：mono、uppercase、8px 圆角、禁用态 0.42 透明度；在 `.panel-shell` 中视觉上服务于 nullframe 黑/橙体系 |

## 8. 响应式 / 无障碍

**响应式**
- 标题用 `clamp()` 流式字号（如 `text-[clamp(2.5rem,7vw,5.5rem)]`），另有 768px 媒体查询兜底 `.hero-title`。
- 断点用法朴素一致：`sm:` 调 padding/双列卡片，`md:` 切换桌面锚点导航 vs 汉堡菜单，`lg:` 切换控制台侧栏布局。
- 内容主体 `max-w-3xl`，移动端体验整体可靠；Relay 画布在触屏上仅有 pointer pan，缺少缩放手势。

**无障碍（现状偏弱）**
- 做了的：`MobileMenu` 有 `aria-label`/`aria-expanded`，下拉箭头和装饰 SVG 标了 `aria-hidden`，下拉支持 Escape 关闭，表单控件有 label。
- 缺失的：ASCII 动画无 `prefers-reduced-motion` 降级、Canvas 无替代文本；大量正文使用 0.6–0.65rem 的 mono 小字 + muted 色 + 额外 `opacity-70`，对比度和可读性堪忧；锚点跳转无 skip-link；自绘下拉无键盘方向键/焦点管理（非 listbox 语义）；颜色是状态的唯一编码（如 box 状态点）。

## 9. 设计债务与改进建议

1. **两套视觉 token 并存但未命名成体系**：基础 `@theme` 是 sandbank 沙金主题，`.panel-shell` 覆盖为 nullframe 黑/橙主题；两者在代码里是 CSS 变量覆盖关系，但文档/设计系统尚未明确命名为两个 mode。建议把 `sandbank` / `nullframe-panel` 两套 token 明文化，避免后续继续把控制台当作普通营销页样式维护。
2. **Clerk 主题仍是硬编码来源**：`clerkAppearance` 中的 `#f26522`、`#000000`、`#111111`、`borderRadius: '16px'` 与 `.panel-shell` token 语义一致但没有共享变量；同一 nullframe 色板存在 CSS 与 TS 两个维护点，应收敛为导出的 token 或至少在注释中建立映射。
3. **`panel.tsx` 体量过大**（2700+ 行单文件，含十几个页面级组件、全部 interface 与 SVG 图标），组件无法复用也难以测试；建议拆为 `panel/` 目录（pages、components、icons、api client 分层）。
4. **i18n 文案与组件耦合**：`src/i18n.ts` 1100+ 行三语字典在一个对象里，新增 key 需要同步三处且无缺失检测；可拆分语言文件并加 `TranslationKey` 完整性校验。
5. **可访问性整改**（按收益排序）：为 `AsciiCanvas` 加 `prefers-reduced-motion` 静态降级；把 0.6rem + opacity 叠加的说明文字提升到 ≥0.7rem 或去掉叠加透明度；给自绘下拉补 listbox/menu 语义与键盘导航。
6. **硬编码 UI 字符串残留**：`CopyButton` 的 `'Copied!'/'Copy'`、版本号 `v0.2.0`（footer 与 i18n badge 双处维护）等未走 i18n。
7. **重复组件**：`LangSwitcher` 在 `home.tsx` 与 `cloud.tsx` 中逐字重复定义，应提取到 `src/components/`。
8. **shiki 全量引入**：`codeToHtml` 直接从 `shiki` 主入口导入，会拉取较大的 wasm/语言包；可改用 fine-grained bundle（仅 ts/bash/json + vitesse-dark）减小首屏体积。
9. **营销页缺少 OG/social 元信息**：`index.html` 只有 title/description，无 `og:*`/`twitter:*` 标签与 og-image，分享呈现差。

---

# 二、Native App

**不适用 / 未发现。**

仓库中没有任何 Native 工程：无 React Native / Expo 配置，无 `ios/`、`android/` 目录，无 Flutter/Swift/Kotlin 代码，`package.json` 亦无相关依赖。移动端体验完全由上述 Web App 的响应式布局承担。若未来新增 Native App，建议沿用本文第 3 节的 token（surface/sand/text 三级灰）与 mono 标签语言，保证跨端品牌一致性。

---

# 附：workers/api（无 UI 的后端 package）

`workers/api/` 是 Cloudflare Worker（D1 数据库 `sandbank-tenant-authority`，路由 `api.sandbank.dev`，779 行 `index.ts` + vitest 测试），承担租户鉴权、项目/节点调度（tyo-1/tyo-2 节点路由）和 Panel API。它没有视觉设计要素，但其 API 形态直接决定了控制台的信息架构（项目→沙盒→Relay→账单的层级即来自 `/v1/panel/*` 响应结构），属于"设计的上游约束"，故在此注明。
