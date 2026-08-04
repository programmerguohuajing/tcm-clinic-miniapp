---
name: 青囊中医馆小程序
description: 面向预约与健康服务的清爽石墨橘红视觉系统
colors:
  primary: "#E76F3C"
  primary-soft: "#FFF0E7"
  neutral-bg: "#F4F5F6"
  surface: "#FFFFFF"
  title: "#17191C"
  text: "#2D3035"
  muted: "#73777D"
  border: "#DEE1E4"
  accent-border: "#FFD8C7"
typography:
  display:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "48rpx"
    fontWeight: 800
    lineHeight: 1.18
    letterSpacing: "-1rpx"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "26rpx"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "22rpx"
    fontWeight: 700
    lineHeight: 1.45
rounded:
  sm: "12rpx"
  md: "18rpx"
  lg: "24rpx"
spacing:
  page-x: "24rpx"
  page-y: "28rpx"
  section: "40rpx"
  card: "24rpx"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 28rpx"
    height: "88rpx"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 24rpx"
    height: "84rpx"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "24rpx"
---

# Design System: 青囊中医馆小程序

## Overview

**Creative North Star: “Service Orange / 橘红服务台”**

这是一个服务先行的中医馆小程序视觉系统：让用户先看懂门店、服务和预约路径，再进入内容浏览。冷灰背景把页面从“宣传海报”拉回到可操作的服务台，石墨文字负责稳定的信息层级，橘红只在行动、选择和预约进度上发声。

整体保持干净、清爽、低装饰密度。卡片是白色实体面，边界用细线和轻微环境阴影表达，不使用渐变、玻璃拟态或表情符号作为装饰。视觉重心来自内容与流程，而不是疗愈氛围特效。

**Key Characteristics:**

- 冷灰画布上的白色服务卡片
- 石墨文字与橘红行动色的高对比层级
- 细边框、克制阴影、圆润但不夸张的形体
- 首屏直接呈现“服务 → 技师 → 时段”的预约路线

## Colors

Palette character: a cool, neutral service surface with one warm, confident action voice.

### Primary

- **Mandarin Orange / 橘红行动色** (`{colors.primary}`): 只用于主按钮、价格、当前步骤、选中态和关键进度。

### Neutral

- **Cool Gray Canvas / 冷灰画布** (`{colors.neutral-bg}`): 页面底色，提供清爽且不刺眼的基底。
- **White Service Surface / 白色服务面** (`{colors.surface}`): 卡片、表单和弹层的实体表面。
- **Graphite Text / 石墨正文** (`{colors.text}`): 正文、导航和主要控件文字。
- **Deep Graphite Title / 深石墨标题** (`{colors.title}`): 首屏标题和高优先级信息。
- **Muted Gray / 灰阶辅助色** (`{colors.muted}`): 说明、时间、次级标签。
- **Hairline Border / 发丝边界** (`{colors.border}`): 卡片、输入框和幽灵按钮边界。

### Named Rules

**The One Voice Rule.** 橘红是稀缺资源；一个视口里只让它承担行动、选择或进度，不把整页染成促销海报。

## Typography

**Display Font:** PingFang SC, with Microsoft YaHei and sans-serif fallbacks
**Body Font:** PingFang SC, with Microsoft YaHei and sans-serif fallbacks

**Character:** 中文优先、清晰耐读，标题用较重字重建立方向，正文保持舒展行高，标签只做短促的状态提示。

### Hierarchy

- **Display** (800, `48rpx`, `1.18`): 首屏主标题和核心承诺。
- **Headline** (800, `32rpx`, `1.28`): 模块标题、服务区标题。
- **Title** (800, `28–30rpx`): 卡片标题、列表标题。
- **Body** (400, `26rpx`, `1.62`): 服务说明、文章摘要和表单辅助内容。
- **Label** (700, `22rpx`, `1.45`): 标签、步骤编号和状态信息。

### Named Rules

**The Readable Route Rule.** 先用标题说明“现在看什么”，再用正文解释“下一步做什么”；不要用小字承担核心信息。

## Layout

小程序采用纵向单列服务流，页面左右留白为 `24rpx`，顶部安全留白为 `28rpx`。模块之间以约 `40rpx` 的 section rhythm 分组，卡片内部使用 `24rpx` 左右的舒适内边距。首页首屏顺序固定为门店识别、预约主行动、服务路线、服务项目、健康资讯和底部导航。

横向服务卡片使用滚动容器；内容页面继续沿用同一页面边距和卡片网格。小屏幕优先保证标题、按钮和步骤标签不被压缩，长文字允许自然换行。

## Elevation & Depth

系统采用“平面优先、轻微抬升”的层次策略。白色卡片在冷灰画布上通过发丝边框和 `0 8rpx 24rpx rgba(45, 48, 53, 0.06)` 的环境阴影获得区分；没有渐变背景，也不使用玻璃模糊。阴影只服务于容器分层，不用来制造装饰光晕。

### Named Rules

**The Flat-by-Default Rule.** 默认表面保持平静；只有需要从画布中脱离的实体卡片、弹层和主按钮才获得轻微深度。

## Shapes

形体使用温和的圆角层级：状态标签 `12rpx`，按钮 `18rpx`，卡片和大容器 `24rpx`。卡片和输入控件优先使用细边框，按钮不使用胶囊式全圆角。所有形体都服务于可点击性与分组，不做拟物装饰。

## Components

### Buttons

- **Shape:** 温和圆角 (`18rpx`)，矩形服务控件而非胶囊。
- **Primary:** 橘红背景、白色文字，最小高度 `88rpx`，用于预约、登录和提交。
- **Hover / Focus:** 小程序端以按下态和系统可访问焦点为主；保留橘红对比，不添加发光或渐变。
- **Secondary / Ghost:** 白色背景、发丝边框、石墨文字，最小高度 `84rpx`，用于取消、次要路径和返回。

### Chips

- **Style:** 浅橘红背景和橘红文字，边框使用浅橘红；短标签应保持单行或自然截断。
- **State:** 当前、优惠和分类可以使用橘红；普通辅助信息回退到灰阶。

### Cards / Containers

- **Corner Style:** `24rpx` 大卡片，`1rpx` 发丝边框。
- **Background:** 白色服务面置于冷灰画布。
- **Shadow Strategy:** 使用 Elevation & Depth 的单一环境阴影。
- **Internal Padding:** 常规卡片使用 `24rpx`，首屏大卡片可按内容增加。

### Inputs / Fields

- **Style:** 白色或冷灰表面、石墨文字、发丝边框、`18rpx` 圆角；辅助说明用灰阶。
- **Focus:** 边框转为橘红，保持清晰但不制造光晕。
- **Error / Disabled:** 错误优先使用语义红色与文字说明；禁用态降低对比度，不改变布局。

### Navigation

- **Style:** 底部四项导航保持白色实体面；默认图标和文字为灰阶，当前项使用橘红。
- **Mobile treatment:** 图标保持线性、克制，选中态通过橘红而非复杂背景表达。

### Booking Route

预约路线是首页的签名组件：用 `01 / 02 / 03` 和细线串起“选择服务、选择技师、选择时段”。当前步骤用橘红，其余步骤使用石墨与灰阶，让用户不用阅读长说明也能理解下一步。

## Do's and Don'ts

### Do:

- **Do** 把橘红留给真正可操作或可选择的内容。
- **Do** 用白色实体面、细边框和轻阴影建立清晰分层。
- **Do** 让首屏先回答“在哪里、做什么、下一步是什么”。
- **Do** 保持中文标题较重、正文行高舒展，确保移动端可读性。

### Don't:

- **Don't** 使用渐变、玻璃拟态、背景模糊或大面积装饰光晕。
- **Don't** 用米白纸张、墨绿色或整屏高饱和橘红替代本系统的冷灰 + 石墨 + 橘红关系。
- **Don't** 用 emoji 充当核心导航、菜单或业务图标。
- **Don't** 把服务页面改造成与预约无关的营销海报。
