# UpdateWave Web — New Home Page (Product Portal) Design

**Date:** 2026-05-04
**Owner:** Matthew Hou
**Status:** Design locked via brainstorming, ready for implementation plan
**Branch:** docs/product-roadmap (this design) → new worktree (implementation)
**Depends on:** Email auth system (parallel worktree, ETA few days)

---

## 1. 背景与目标

### 1.1 当前 `/` 现状

- 文件:[src/app/page.tsx](../../src/app/page.tsx),42 行
- Hero:"Pre-permit projects in your area" + "$25 reveal"
- 行为:直接渲染所有 published projects(公开,无 hash)
- **问题:** 与新产品定位脱节
  - 价格仍写 $25(产品已升级到 $129 decoy / $499 主力 / $1999 旗舰)
  - 把 lead 当主角(新主力是 $499 city list)
  - 没有 $499 city list 入口
  - Hash 模型即将被 email auth 替换,门面没准备

### 1.2 本次目标

替换 `/` 为**公开产品门面**,作为三层定价产品的统一入口,配合即将上线的 email auth 系统支持冷流量从浏览 → 注册 → 购买的完整闭环。

### 1.3 与 roadmap 的关系

本次工作对应 [docs/plans/2026-04-20-roadmap.md](2026-04-20-roadmap.md) 中的:
- **WS-2 完成态:** $129 lead 重定位为 decoy(在 home page 三 card 中体现)
- **WS-1 主推延伸:** 把 $499 city list 从单独的 `/list/[hash]/[city]` 页面延伸到公开门面入口
- **WS-3 占位:** $1999 research 在门面中以 "Coming Soon / Talk to us" 形态存在,为后续 spec 铺路
- **WS-5 触发:** Hash → email 迁移与 home page 一起落地

---

## 2. 锁定 Spec(Brainstorming 决策汇总)

| 维度 | 决策 |
|---|---|
| 范围 | 替换现有 `/`,作为公开门面 |
| 主结构 | 三产品索引($129 lead / $499 city list / $1999 research) |
| $1999 处理 | Coming Soon / Talk to us(`mailto:matthew.chivalri@gmail.com`) |
| Auth 状态 | Supabase Auth + magic link(parallel worktree,几天内 ready) |
| Hash 关系 | 完全替换;老 URL 双权限源(hash + user_id),home 不展示 hash 入口 |
| 已登录态 | Welcome back 区块(仅有购买的用户)+ My purchases 入口 |
| Anchor pricing | 中间 card 加 "Most Popular" + 单位价格 `$16.63/architect` 小字 |
| 视觉 | 完全 reuse 现有 design tokens(无 refresh) |

---

## 3. 范围边界

### ✅ 本 worktree 范围

1. `/` 替换为新门面
2. `/list/[city]` 公开城市营销页(新建,3 城市:sf / sj / fremont)
3. `/leads` 公开 lead 预览页(新建)
4. `/research` $1999 介绍页 + Talk to us CTA(新建)
5. 老 `/browse/[hash]` `/list/[hash]/[city]` `/reveals/[hash]` 改造为 hash + user_id 双权限源
6. Webhook 改造为按 user_id 创建 `reveals` / `list_purchases`(向后兼容 hash)
7. 测试覆盖(unit + integration + E2E)

### ❌ 不在本范围(Auth worktree 负责)

- `signInWithOtp` magic link 实现
- `/auth/sign-in` `/auth/callback` 路由
- 用户表 schema 改造(email 列、user_id 关联)
- 老 hash → email 关联迁移逻辑(用户首次登录时把现有 hash 的购买记录归入新 user)

### ❌ 故意不做(YAGNI)

- Customer testimonial(N=1,没素材)
- Social proof number("Join 1,200 GCs")
- Newsletter signup
- Blog / resources 入口
- 个性化推荐
- A/B testing 基础设施
- 加 PostHog / Mixpanel(现有 Vercel Analytics 足够)

---

## 4. 路由设计

### 4.1 新建公开路由

| 路径 | 类型 | Auth | 内容 |
|---|---|---|---|
| `/` | Server Component | 公开 | 门面:Hero + 三 card + How it works + FAQ |
| `/list/[city]` | Server Component | 公开 | 城市营销页(去 hash 版),3 sample architects + Buy CTA |
| `/leads` | Server Component | 公开 | Lead 预览页(几条模糊化 sample) + Buy CTA |
| `/research` | Server Component | 公开 | Custom research 介绍 + `mailto:` Talk to us CTA |

### 4.2 改造现有路由(双权限源)

| 路径 | 改造 |
|---|---|
| `/browse/[hash]` | 同时接受 `hash` 或 `auth.getUser().id`(任一) |
| `/list/[hash]/[city]` | 同上 |
| `/list/[hash]/[city]/success` | 同上 |
| `/reveals/[hash]` | 同上 |

### 4.3 Auth 集成点

- 所有 Server Component 服务端读 `supabase.auth.getUser()`
- 三 card CTA 链接公开 route,无需 session
- Buy 按钮(在 `/list/[city]` `/leads` 内):
  - 未登录 → redirect 到 `/auth/sign-in?next=<encoded current URL>`
  - 已登录 → 直接调用 `/api/create-list-checkout` 或 `/api/create-checkout`

---

## 5. 详细组件 Spec

### 5.1 Header(sticky top)

```
未登录:  [UpdateWave]                                            [Sign in →]
已登录:  [UpdateWave]              {email} · My purchases · Sign out
```

- 容器:复用现有 `bg-white border-b border-gray-200 h-14`
- 已登录态从 `supabase.auth.getUser()` 服务端拉
- `My purchases` 链接到 `/reveals/[user_id]`(老路由,user_id 作为新 hash 等价物)

### 5.2 Hero

- 标题(单行,粗体,大字):`Architect intelligence for general contractors.`
- 副标题(2 行):`Stop chasing leads after permits drop. Find architects who keep filing — and own the relationship.`
- 容器:`max-w-6xl mx-auto px-4 py-12`
- 不放 illustration / hero image / video / animation(utility-first 调性,避免 AI slop)

### 5.3 Welcome back 区块(仅已购买用户)

```
Welcome back. You have 2 city lists and 5 reveals.  View →
```

- 仅当 `list_purchases.count + reveals.count > 0` 时渲染
- 新登录但未购买的用户:不渲染
- 14px 文字,灰底,thin row

### 5.4 三产品 Card

桌面 3 列并排,移动端纵向堆叠。同高,中间 card 略大或加 "Most Popular" badge。

#### Card 1 — $129 Lead

- 标题:`Single Pre-Permit Lead`
- 副标题:`When you need to chase a hot project right now.`
- 价格:`$129 / lead` + 小字 `~30 architects/month available`
- 视觉:1 张样式卡(模仿 ProjectList 单条),内容用 sample 项目模糊化
- CTA:`Browse leads →` → `/leads`

#### Card 2 — $499 City Hot List(主推,Most Popular)

- 标题:`City Hot Architect List 2025`
- 副标题:`30 high-volume architects per city, with project history.`
- 价格:`$499 / city / year` + 小字 `≈ $16.63 per architect`
- 视觉:3 个 city pill(SF / SJ / Fremont)
- CTA:三个 pill 各自链接到 `/list/sf` `/list/sj` `/list/fremont`
- 视觉强调:elevated shadow + "Most Popular" badge

#### Card 3 — $1999 Custom Research

- 标题:`Custom Market Research`
- 副标题:`Region-level analysis tailored to your business.`
- 价格:`From $1,999` + 小字 `Talk to us about scope.`
- 视觉:简洁,无 sample
- CTA:`Talk to us →` → `mailto:matthew.chivalri@gmail.com?subject=UpdateWave%20Custom%20Research%20Inquiry`

### 5.5 How it works(3 步横排)

1. **See what's filed** — Pre-permit project filings from city planning commissions.
2. **Identify high-volume architects** — Find who keeps filing, year after year.
3. **Build relationships** — Win bids before permits drop.

### 5.6 FAQ(折叠,5 条)

- Where does the data come from?(Public planning commission filings.)
- How often is it updated?(Per city list = annual; lead feed = continuous.)
- What's your refund policy?(Stripe receipt + your specific policy line.)
- What's the difference between a single lead and a city list?(Anchor pricing 复述。)
- Is this data legally usable?(Public records — yes.)

### 5.7 Footer

复用现有:单行 `All listings sourced from public planning commission filings.`

---

## 6. 数据流

### 6.1 未登录购买流程

```
/list/sf (anon)
  → click Buy
  → /auth/sign-in?next=/api/create-list-checkout?city=sf
  → magic link email
  → /auth/callback?next=/api/create-list-checkout?city=sf
  → /api/create-list-checkout(now with session)
  → Stripe Checkout
  → webhook 创建 list_purchase by user_id
  → /list/[user_id]/sf/success
```

### 6.2 已登录购买流程

```
/list/sf
  → click Buy
  → /api/create-list-checkout(with session)
  → Stripe Checkout
  → webhook 创建 list_purchase by user_id
  → /list/[user_id]/sf/success
```

### 6.3 已购城市智能跳转

Home page Card 2 上 SF / SJ / Fremont pill 点击:

```ts
if (user.has_purchased(city)) {
  redirect(`/list/${user_id}/${city}/success`)  // 直接下载页
} else {
  redirect(`/list/${city}`)  // 公开营销页
}
```

服务端在 home render 时已查 `list_purchases by user_id`(为 Welcome back 区块),复用此查询不增加成本。

---

## 7. Webhook 改造

现有 webhook(`src/app/api/webhook/route.ts`)用 hash 创建记录。改造为 user_id 优先 + hash 兜底:

```ts
const userId = session.metadata?.user_id
  ?? await hashToUserId(session.metadata?.hash)

if (!userId) {
  // log + return 400
}

if (productType === 'list') {
  await insertListPurchase({
    user_id: userId,
    city_list_id: session.metadata.city_list_id,
    stripe_session_id: session.id
  })
} else {
  await insertReveal({
    user_id: userId,
    project_id: session.metadata.project_id,
    stripe_session_id: session.id
  })
}
```

**幂等保留:**
- `UNIQUE(stripe_session_id)` on both tables
- `UNIQUE(user_id, city_list_id)` on `list_purchases`
- `UNIQUE(user_id, project_id)` on `reveals`

---

## 8. 测试覆盖

### 8.1 Unit

- Home page server component renders correctly with/without session(快照测试)
- Welcome back 区块在 `has_purchases === true` 时渲染,否则不渲染
- 已购城市智能跳转逻辑

### 8.2 Integration

- `/list/[city]` 公开版查询不泄露 hash / user_id 字段
- Webhook 用 user_id 创建 reveal / list_purchase(新流程)
- Webhook 用 hash 仍能创建记录(向后兼容)
- 老 hash 路由(`/browse/[hash]` 等)仍然工作

### 8.3 E2E

- 未登录访问 `/` → 看见三 card → 各自 CTA 到正确 destination
- 登录无购买访问 `/` → 不显示 Welcome back
- 登录有购买访问 `/` → 显示 Welcome back 区块带正确数字
- 已购城市 → home 点击该 city pill → 跳成功页(非营销页)
- 未登录 → `/list/sf` → click Buy → 跳 sign-in → 验证完成 → 回到原 checkout 流程

---

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| Auth worktree 延期,home 无法 buy | Home v1 ship 时 Buy 按钮 disabled,文字 "Coming with email auth — talk to us"; auth ready 后切换到真 checkout |
| 老 hash 用户登录后无法关联购买记录 | Auth worktree 负责实现 hash → user_id 关联;本次测试覆盖此场景 |
| Email auth 上线初期送达问题 | Supabase Auth 自带 SMTP/SES;首批客户出问题 manual fallback(你私信发链接) |
| `/list/[city]` 公开版被爬 sample architect 信息 | 只显示 3 个 + 姓名部分模糊化(姓 + 名首字母);完整信息走付费;`<meta name="referrer" content="no-referrer">` 已设 |
| 双权限源逻辑出 bug 影响老用户 | 所有改造加 integration + E2E 覆盖;老 hash 流程 e2e 不下线 |
| Webhook 改造破坏现有 $129 reveal 流程 | 保留 hash fallback 路径;切换前 staging 全量回归 |

---

## 10. Implementation 时间表(预估 7 天)

具体取决于 auth worktree 的 sign-in / sign-up API 何时可用。

| Day | 工作 |
|---|---|
| 1 | 路由架构 + `auth.getUser()` 集成(home + 三个新 route 的骨架) |
| 2 | Home page UI(Hero + 三 card + How it works + FAQ + Welcome back) |
| 3 | `/list/[city]` 公开版 + `/leads` 公开版(复用现有 city list 营销组件) |
| 4 | `/research` 页 + 老 hash 路由双权限源改造 |
| 5 | Webhook user_id 改造 + 已购城市智能跳转 |
| 6 | 测试覆盖(unit + integration + E2E) |
| 7 | QA + polish + ship |

---

## 11. 决策日志(brainstorming 5 月 4 日)

- **Q1 → A:** 替换现有 `/` 而非新增 SEO 页(SEO 留 WS-6,本次先把门面对齐新定位)
- **Q2 → A:** 三层定价产品索引($129 / $499 / $1999),沿用 roadmap 定价表
- **Q3 → A:** $1999 = Coming Soon 占位,保留三阶梯 anchor pricing
- **Q4 → 跳过:** Auth 几天 ready,直接对接 auth.getUser()
- **Q5 → A:** Auth 系统并行 worktree,马上 ready,home 可依赖
- **Q6 → A:** 完全替换 hash(老 URL 向后兼容,home 不展示 hash 入口)
- **范围 → "完整做完":** 三新公开 route + 老路由双权限源 + webhook 改造一并做
- **三 card 视觉细节:** 三 city pill / mailto / Most Popular badge / 完全 reuse 现有视觉

---

## 12. 下一步

1. ✅ 本 design 文档 commit 到 `docs/product-roadmap` 分支
2. 用 `superpowers:using-git-worktrees` 在 main 上 fork 一个 implementation worktree(分支名 `feat/home-page-product-portal`)
3. 用 `superpowers:writing-plans` 把 Section 4-8 拆成 bite-sized 实现 task 清单
4. Auth worktree 协调:确认 `signInWithOtp` / `getUser` / session API 的 import path 与时间线
5. 按 7 天时间表执行,每天 ship 一个可验证里程碑
