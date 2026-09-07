# 概览：SAAS 化改造计划 + 多业态 C 端页面 PRD

## 交付物
- `docs/saas-transformation-plan.md` — 项目改造计划（路线图 / 架构演进 / ADR / 风险 / 指标）
- `docs/prd-multi-industry-cpages.md` — PRD：多业态可配置 C 端页面（页面引擎 v1）
- `docs/prd-payment-multi-subject.md` — PRD：多主体支付能力（个人虚拟支付 + 个体工商户微信支付）

## 核心结论
1. **现状**：系统是"一个中医馆的代码复印"——`schema.sql` 无 `tenant_id`，`home.wxml` 与 `admin-shared/constants.js` 硬编码「中医馆 / 技师 / 健康资讯」等业务词；但已有 `homepage_configs`（store 级 section 配置）是可配置化的良好起点。
2. **改造方向**：引入「租户层 → 业态模板层 → C 端页面引擎 → 管理端模板化 → 商业化」五层架构。
3. **本期 PRD 核心**：业态模板 + 术语字典 + 租户级页面区块配置，使新增健身房等业态零代码上线。

## 阶段划分
- Phase 0 多租户地基（前置） → Phase 1 业态模板 + 页面引擎（本期 PRD） → Phase 1.5 多主体支付能力（可与 Phase 1 并行） → Phase 2 管理端模板化 → Phase 3 套餐/能力包门控（P2，无计费/用量）

## 开发进度（代码已落地，git 未提交）
- ✅ Phase 0 多租户数据隔离：业务表 tenant_id + 索引 + demo 数据回填；`tenant-context` 中间件 + `tenantFilter` 助手；管理端写路径强制租户归属
- ✅ Phase 1 P0 页面引擎：四表迁移 + `page-engine` 纯函数 + `cpages` 路由 + 22 项单测
- ✅ R5 小程序 C 端动态渲染：`home.wxml/js` 改引擎驱动，硬编码业务词 grep=0
- ✅ R6 管理端页面配置界面：`PageConfigView.vue` + 租户下拉/品牌/区块增删改
- ✅ **Phase 1.5a 支付模型与路由（R1/R2/R5 状态机）**：`services.goods_type` + `payment_orders` 统一订单表；`payment-router`（按 subject_type×goods_type 路由，个人+到店服务拦截引导升级）+ `payment-order-state`（状态机）；`payments.js` 路由（/route 决策、/orders 建单、/notify、/query 查单兜底，无凭证走 mock）；15 项单测
- ✅ **Phase 1.5b/c 地基（可离线单测）**：`wechat-pay.js`（signMd5/buildJSApiPayParams/verifyNotifySignature）+ `virtual-pay.js`（buildVirtualPayData/signNotify/verifyNotify）纯函数；已接入 `/orders` 拉起参数构造与 `/notify` 验签接入点（无凭证仍 mock）；5 项单测。真实网络调用（统一下单/虚拟支付后台下单）待微信凭证就位后填充
- ✅ **Phase 1.5b 虚拟支付真实接口（R3/R6）**：`virtual-pay.js` 新增 `createVirtualOrder`（xpay `create_order` 后台下单，HMAC-SHA256 signature 注入 fetch 调用点）、`queryVirtualOrder`、`refundVirtualOrder`，全部带"缺凭证回退 mock、不触真网"守卫；小程序 `utils/pay.js` 封装 `wx.requestVirtualPayment` + 发货回执 `notifyPaid`（R6 兜底）。`payments.js` 接入 `payParams.channel="virtual_pay"` + `/notify` 验签
- ✅ **Phase 1.5c 微信支付真实接口（R4）**：`wechat-pay.js` 新增 `unifiedOrder`（JSAPI v2 统一下单，构造 XML + `signMd5` + 注入 fetch 调 `api.mch.weixin.qq.com/pay/unifiedorder`）、`refundOrder`（退款 XML）、`xmlGetTag`（CDATA 兼容）；`verifyNotifySignature`（HMAC-SHA256）接入 `/notify`。全部带凭证守卫，无凭证回退 mock
- ✅ **Phase 1.5d 退款闭环 + 商户交易视图（R7-R9 + iOS IAP）**：`migrate_refunds.sql`（`payment_refunds` 表）；`payments.js` 新增 `POST /refunds`（需 `requireAdmin`，真实退款按渠道路由 wechat/virtual，状态推进 paid/delivered→refunding，状态机 `refund_request/refund_success/refund_fail` 白名单跃迁，失败回滚 paid）+ `/refunds/:no/notify` 回调 + `POST /iospay/verify`（R7 iOS 收据占位校验，落 iOS 订单）+ `GET /admin/merchant/transactions`（R9 按租户交易列表 + 金额/笔数汇总，需 `requireAdmin`）；`MerchantTransactionsView.vue`（R9 商户交易视图 + 退款弹窗）
- ✅ **Phase 1 P1（R7-R9 多 page/数据来源/健身房模型）**：`industry_templates.default_pages` 多 page 区块 + 引擎多 page 解析（优先 `default_pages[pageKey]` 回退 `default_sections`）；`/services` 支持 `category`+`tenantId` 过滤、新增 `/membership-cards` 数据源（tenantSlug 解析）；`services.goods_type` + `membership_cards` 表 + 健身房种子（团课/私教/月卡/季卡/次卡）；C 端 `home.js` 的 `SOURCE_API` 补全 `courses`(`/services?category=gym_course`)/`membership`/`coaches` + `home.wxml` 会员卡列表真实渲染；`booking.js`/`profile.js` 接入术语字典（R3）；引擎单测扩至 22 项
- ✅ **Phase 2 管理端模板化**：`admin-shared/constants.js` 导航去硬编码 → `resolveNavItems({planMenus, templateKey})` 按业态模板 + 套餐过滤；`AdminLayout.vue` 品牌字改为按租户 `name` 动态（`brandName`），侧边栏 `visibleNav` 由 `resolveNavItems` 驱动（青囊/动力等品牌字不再写死）；小程序 `home.js` 新增 `applyTabBar(terms.nav)` 用术语字典动态设置 tabBar 标题（首页/预约/档案/我的）
- ✅ **Phase 3 套餐能力门控（R13）**：`migrate_plans.sql`（`plans` 套餐定义 + `tenant_plans` 关联，种子 basic/pro/flagship）；`entitlement.js` 纯函数（`resolveEntitlements`/`isMenuAllowed`/`hasCapability`/`filterNavByPlan` + `DEFAULT_PLANS`/`ALL_MENUS`/`ALL_CAPABILITIES`）；`cpages.js` 新增 `GET /admin/plans`、`GET/PUT /admin/tenants/:id/plan`（设套餐历史留存）；`admin-shared` 新增 `createCommerceApi`（含 `plans`/`tenantPlan`/`setTenantPlan`/`merchantTransactions`/`createRefund`）；`PlanManagementView.vue`（套餐卡片 + 应用到租户）、`MerchantTransactionsView.vue`；AdminLayout 按套餐过滤可见菜单。无计费/用量，仅门控菜单 + 能力（ADR-5）

## 需老板对齐的关键决策
- 租户识别方式（子域名 / 小程序 appid）
- 首期支持业态范围（中医馆 + 健身房？）
- 套餐仅做菜单/能力门控，无计费/用量（已确认）
- 支付：个人主体仅虚拟商品走虚拟支付、到店服务需个体工商户+微信支付；各业态类目是否命中"工具"类目、月限 10 万、预约定金合规边界（见支付 PRD Q1-Q3）
- 团课 / 会员卡是否进 Phase 1
- 品牌视觉自定义范围
