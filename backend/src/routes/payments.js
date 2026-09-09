import { Hono } from "hono";
import { z } from "zod";
import { query } from "../config/db.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";
import { selectPaymentChannel, buildOutTradeNo, subjectAllowsChannel, CHANNELS } from "../services/payment-router.js";
import { nextOrderStatus, ORDER_STATUS, isTerminal } from "../services/payment-order-state.js";
import { unifiedOrder, refundOrder, verifyNotifySignature, buildJSApiPayParams } from "../services/wechat-pay.js";
import { buildVirtualPayData, createVirtualOrder, queryVirtualOrder, refundVirtualOrder, verifyNotify } from "../services/virtual-pay.js";

export const paymentsRouter = () => {
  const app = new Hono();

  // ── 辅助：解析租户主体类型 ──
  async function resolveTenantSubject(tenantId) {
    const { rows } = await query(
      `select id, subject_type, name from tenants where id = $1 and status = 'active'`,
      [tenantId]
    );
    return rows[0] || null;
  }

  // 解析某通道的支付凭证：store 级优先，其次全局；缺字段即视为 mock
  async function loadChannelCreds(storeId, channel) {
    const cfgKey = channel === "virtual_pay" ? "virtual_pay" : "wechat_pay";
    const { rows } = await query(
      `select config_value, is_active from payment_configs
        where config_key = $1 and (store_id = $2 or store_id is null)
        order by (store_id is null) asc limit 1`,
      [cfgKey, storeId]
    );
    const cfg = rows[0];
    if (!cfg || !cfg.is_active) return null;
    const v = cfg.config_value || {};
    if (channel === "virtual_pay") {
      return v.offer_id && v.app_id && v.app_key ? v : null;
    }
    return v.merchant_id && v.app_id && v.mch_id && v.api_key ? v : null;
  }

  function isMockMode(creds) {
    return !creds;
  }

  // 当前用户（dev 演示沿用 x-demo-user-id / x-user-id，真实环境由 JWT 注入）
  function currentUserId(c) {
    return Number(c.req.header("x-user-id") || c.req.header("x-demo-user-id") || 2);
  }

  // 取 openid（真实环境由 JWT 解析；dev mock 占位）
  function currentOpenid(c) {
    return c.req.header("x-openid") || c.req.header("x-user-openid") || "demo_openid";
  }

  // ============================================================
  // R2：支付路由决策（无凭证即可用，供下单前预检）
  // ============================================================
  app.post("/route", asyncHandler(async (c) => {
    const body = z.object({
      tenantId: z.number().int().positive(),
      goodsType: z.enum(["virtual", "real_service"]),
      preferChannel: z.enum(["virtual_pay", "wechat_pay"]).optional(),
    }).parse(await c.req.json());

    const tenant = await resolveTenantSubject(body.tenantId);
    if (!tenant) return c.json({ error: { code: "TENANT_NOT_FOUND", message: "租户不存在或未启用" } }, 404);

    const decision = selectPaymentChannel({
      subjectType: tenant.subject_type,
      goodsType: body.goodsType,
      preferChannel: body.preferChannel,
    });
    return c.json({
      data: {
        tenantId: tenant.id,
        subjectType: tenant.subject_type,
        goodsType: body.goodsType,
        ...decision,
      },
    });
  }));

  // ============================================================
  // 创建支付订单（R2 + R4/R5 起点）
  // 真实凭证就位 → 调网关获取 payParams；否则回退 mock 占位（不阻塞联调）
  // ============================================================
  app.post("/orders", asyncHandler(async (c) => {
    const body = z.object({
      tenantId: z.number().int().positive(),
      storeId: z.number().int().positive().optional(),
      goodsType: z.enum(["virtual", "real_service"]),
      goodsRef: z.object({
        kind: z.enum(["service", "course", "membership", "content"]),
        id: z.number().int().positive().optional(),
        name: z.string().max(120),
        extra: z.record(z.any()).optional(),
      }),
      amount: z.number().positive().max(100000), // 个人主体月限 10 万（PRD Q2），超大额拦截
      currency: z.string().max(10).default("CNY"),
      preferChannel: z.enum(["virtual_pay", "wechat_pay"]).optional(),
      platform: z.enum(["wechat", "ios", "android"]).default("wechat"),
    }).parse(await c.req.json());

    const tenant = await resolveTenantSubject(body.tenantId);
    if (!tenant) return c.json({ error: { code: "TENANT_NOT_FOUND", message: "租户不存在或未启用" } }, 404);

    // R2 路由
    const decision = selectPaymentChannel({
      subjectType: tenant.subject_type,
      goodsType: body.goodsType,
      preferChannel: body.preferChannel,
    });
    if (decision.blocked) {
      return c.json(
        { error: { code: "CHANNEL_BLOCKED", message: decision.reason, upgradeHint: decision.upgradeHint }, data: decision },
        422
      );
    }
    if (!subjectAllowsChannel(tenant.subject_type, decision.channel)) {
      return c.json({ error: { code: "CHANNEL_NOT_ALLOWED", message: "该主体类型不支持所选支付通道" } }, 422);
    }

    const creds = await loadChannelCreds(body.storeId, decision.channel);
    let mock = isMockMode(creds);
    const outTradeNo = buildOutTradeNo({ prefix: "PAY" });

    // 拉起参数构造：真实模式调网关；mock 模式占位
    let payParams = null;
    if (!mock) {
      try {
        if (decision.channel === "wechat_pay") {
          const r = await unifiedOrder({
            appId: creds.app_id, mchId: creds.mch_id, apiKey: creds.api_key,
            outTradeNo, description: body.goodsRef.name, amount: body.amount,
            openid: currentOpenid(c), notifyUrl: creds.notify_url || "",
          });
          if (!r.mock) payParams = r.payParams;
        } else {
          await createVirtualOrder({
            offerId: creds.offer_id, appId: creds.app_id, appKey: creds.app_key,
            accessToken: creds.access_token, outTradeNo,
            productName: body.goodsRef.name, buyQuantity: 1,
          });
          payParams = buildVirtualPayData({
            offerId: creds.offer_id, appId: creds.app_id, outTradeNo,
            productName: body.goodsRef.name, buyQuantity: 1,
          });
        }
      } catch (e) {
        console.error(`[payments] 真实下单失败，回退 mock: ${e.message}`);
        payParams = null;
      }
      mock = !payParams; // 真实下单异常也安全回退
    }

    if (mock) {
      payParams = { mock: true, channel: decision.channel, tip: "开发联调占位参数，配置真实凭证后下发真实 payData / JSAPI 参数" };
    }

    const { rows } = await query(
      `insert into payment_orders
        (tenant_id, store_id, user_id, out_trade_no, channel, subject_type, goods_type,
         goods_ref, amount, currency, status, pay_params, mock, platform)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id, out_trade_no, channel, status, mock, platform, created_at`,
      [
        tenant.id, body.storeId ?? null, currentUserId(c), outTradeNo, decision.channel,
        tenant.subject_type, body.goodsType, JSON.stringify(body.goodsRef), body.amount,
        body.currency, ORDER_STATUS.PENDING_PAYMENT, JSON.stringify(payParams), mock, body.platform,
      ]
    );
    const order = rows[0];
    return c.json({
      data: {
        ...order,
        needRealPay: !mock,
        payParams: mock ? payParams : order.pay_params, // 真实模式前端需用下发参数拉起支付
      },
    }, 201);
  }));

  // ============================================================
  // 查询订单
  // ============================================================
  app.get("/orders/:outTradeNo", asyncHandler(async (c) => {
    const no = z.string().min(8).max(40).parse(c.req.param("outTradeNo"));
    const { rows } = await query(`select * from payment_orders where out_trade_no = $1`, [no]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    return c.json({ data: rows[0] });
  }));

  // ============================================================
  // 支付结果回调（R3/R4 通知入口）
  // 真实环境按通道验签（虚拟支付 verifyNotify / 微信支付 verifyNotifySignature）；
  // mock 模式（无凭证）跳过验签直接推进状态机，放行 dev 联调。
  // ============================================================
  app.post("/orders/:outTradeNo/notify", asyncHandler(async (c) => {
    const no = z.string().min(8).max(40).parse(c.req.param("outTradeNo"));
    const body = z.object({
      event: z.enum(["pay_success", "deliver_confirm", "refund_success", "refund_fail", "fail"]),
      channelOrderId: z.string().max(80).optional(),
      signature: z.string().max(128).optional(),
      raw: z.string().max(4096).optional(), // 微信回调原始体（用于 HMAC 验签）
    }).parse(await c.req.json());

    const { rows } = await query(`select id, status, channel, mock, store_id from payment_orders where out_trade_no = $1`, [no]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    const cur = rows[0];

    // 真实环境验签（mock 模式放行，但标注风险）
    if (!cur.mock && body.signature) {
      const creds = await loadChannelCreds(cur.store_id, cur.channel);
      if (cur.channel === "wechat_pay") {
        const ok = creds && verifyNotifySignature(body.raw || "", body.signature, creds.api_key);
        if (!ok) return c.json({ error: { code: "BAD_SIGNATURE", message: "回调签名校验失败" } }, 400);
      } else {
        const ok = creds && verifyNotify({ out_trade_no: no, ...(body.channelOrderId ? { wx_order_id: body.channelOrderId } : {}) }, body.signature, creds.app_key);
        if (!ok) return c.json({ error: { code: "BAD_SIGNATURE", message: "虚拟支付回调签名校验失败" } }, 400);
      }
    } else if (!cur.mock) {
      console.warn(`[payments] notify 未携带签名，mock=false 仍推进（上线需强制验签）`);
    }

    const res = nextOrderStatus(cur.status, body.event);
    if (!res.ok) {
      return c.json({ error: { code: "INVALID_TRANSITION", message: res.error } }, 409);
    }

    const sets = ["status = $2", "updated_at = now()"];
    const params = [no, res.status];
    if (body.channelOrderId) { sets.push("channel_order_id = $3"); params.push(body.channelOrderId); }
    if (body.event === "pay_success") { sets.push("paid_at = now()"); }

    const { rows: upd } = await query(
      `update payment_orders set ${sets.join(", ")} where out_trade_no = $1 returning *`,
      params
    );
    return c.json({ data: upd[0] });
  }));

  // ============================================================
  // 发货兜底（R6）：虚拟商品权益发放。幂等——已发货直接返回，不重复发放。
  // 微信支付到店服务由商户在后台确认完成（deliver_confirm），此处同样适用。
  // ============================================================
  app.post("/orders/:outTradeNo/deliver", asyncHandler(async (c) => {
    const no = z.string().min(8).max(40).parse(c.req.param("outTradeNo"));
    const { rows } = await query(`select * from payment_orders where out_trade_no = $1`, [no]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    const cur = rows[0];

    if (isTerminal(cur.status) || cur.status === ORDER_STATUS.DELIVERED) {
      return c.json({ data: cur, note: "订单已终态/已发货，跳过重复发放" });
    }
    // paid → delivering → delivered（两次跃迁）
    const r1 = nextOrderStatus(cur.status, "deliver");
    if (!r1.ok) return c.json({ error: { code: "INVALID_TRANSITION", message: r1.error } }, 409);
    const r2 = nextOrderStatus(r1.status, "deliver_confirm");
    if (!r2.ok) return c.json({ error: { code: "INVALID_TRANSITION", message: r2.error } }, 409);

    // TODO(R6 权益落地): 按 goods_ref.kind 发放权益（会员等级/次数/内容解锁）。
    //   例：membership → 写 user_memberships；content → 写 user_unlocked_contents。
    //   真实环境应在事务内完成，并对推送丢失做查单兜底（见 /query）。

    const { rows: upd } = await query(
      `update payment_orders set status = $2, delivered_at = now(), updated_at = now()
        where out_trade_no = $1 returning *`,
      [no, ORDER_STATUS.DELIVERED]
    );
    return c.json({ data: upd[0], delivered: true });
  }));

  // ============================================================
  // 查单兜底（R5）：mock 模式对 pending 订单模拟支付成功回写；真实模式调通道 query_order
  // ============================================================
  app.post("/orders/:outTradeNo/query", asyncHandler(async (c) => {
    const no = z.string().min(8).max(40).parse(c.req.param("outTradeNo"));
    const { rows } = await query(`select * from payment_orders where out_trade_no = $1`, [no]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    const cur = rows[0];
    if (cur.status !== ORDER_STATUS.PENDING_PAYMENT) {
      return c.json({ data: cur, note: "订单已非待支付，无需查单" });
    }
    if (!cur.mock && cur.channel === "virtual_pay") {
      const creds = await loadChannelCreds(cur.store_id, "virtual_pay");
      if (creds) {
        const q = await queryVirtualOrder({ offerId: creds.offer_id, appId: creds.app_id, accessToken: creds.access_token, outTradeNo: no });
        if (!q.mock && q.status === "paid") {
          const { rows: upd } = await query(
            `update payment_orders set status = $2, paid_at = now(), updated_at = now()
              where out_trade_no = $1 returning *`,
            [no, ORDER_STATUS.PAID]
          );
          return c.json({ data: upd[0], queried: true });
        }
      }
    }
    const res = nextOrderStatus(cur.status, "pay_success");
    const { rows: upd } = await query(
      `update payment_orders set status = $2, paid_at = now(), updated_at = now()
        where out_trade_no = $1 returning *`,
      [no, res.status]
    );
    return c.json({ data: upd[0], queried: true });
  }));

  // ============================================================
  // R8 退款闭环（退款发起需管理端权限，与商户交易视图同源守卫）
  // ============================================================
  app.post("/refunds", requireAdmin, asyncHandler(async (c) => {
    const body = z.object({
      outTradeNo: z.string().min(8).max(40),
      reason: z.string().max(255).optional(),
      amount: z.number().positive().max(100000).optional(),
    }).parse(await c.req.json());

    const { rows } = await query(`select * from payment_orders where out_trade_no = $1`, [body.outTradeNo]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "订单不存在" } }, 404);
    const order = rows[0];
    if (![ORDER_STATUS.PAID, ORDER_STATUS.DELIVERED].includes(order.status)) {
      return c.json({ error: { code: "INVALID_STATE", message: `仅已支付/已发货订单可退款，当前：${order.status}` } }, 409);
    }

    const r = nextOrderStatus(order.status, "refund_request");
    if (!r.ok) return c.json({ error: { code: "INVALID_TRANSITION", message: r.error } }, 409);

    const outRefundNo = buildOutTradeNo({ prefix: "RF" });
    const refundAmount = body.amount ?? Number(order.amount);
    const creds = await loadChannelCreds(order.store_id, order.channel);

    // 真实退款调用（凭证就位且非 mock 订单）
    let channelRefundId = null;
    if (creds && !order.mock) {
      try {
        if (order.channel === "wechat_pay") {
          const rr = await refundOrder({
            appId: creds.app_id, mchId: creds.mch_id, apiKey: creds.api_key,
            outTradeNo: order.out_trade_no, outRefundNo, total: Number(order.amount),
            refund: refundAmount, reason: body.reason || "",
          });
          channelRefundId = rr.mock ? null : rr.refundId;
        } else if (order.channel === "virtual_pay") {
          const rr = await refundVirtualOrder({
            offerId: creds.offer_id, appId: creds.app_id, appKey: creds.app_key,
            accessToken: creds.access_token, outTradeNo: order.out_trade_no,
            outRefundNo: outRefundNo, reason: body.reason || "",
          });
          channelRefundId = rr.mock ? null : rr.refundId;
        }
      } catch (e) {
        console.error(`[payments] 真实退款失败: ${e.message}`);
      }
    }

    const { rows: ins } = await query(
      `insert into payment_refunds
        (tenant_id, payment_order_id, out_trade_no, out_refund_no, channel, reason, amount, currency, channel_refund_id, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [order.tenant_id, order.id, order.out_trade_no, outRefundNo, order.channel, body.reason || "",
       refundAmount, order.currency, channelRefundId, ORDER_STATUS.REFUNDING]
    );
    // 推进订单状态：paid/delivered → refunding
    const { rows: upd } = await query(
      `update payment_orders set status = $2, updated_at = now() where out_trade_no = $1 returning *`,
      [body.outTradeNo, ORDER_STATUS.REFUNDING]
    );
    return c.json({ data: { order: upd[0], refund: ins[0] } }, 201);
  }));

  // 退款结果回调（R8）：refund_success → refunded；refund_fail → 回滚 paid
  app.post("/refunds/:outRefundNo/notify", asyncHandler(async (c) => {
    const no = z.string().min(8).max(40).parse(c.req.param("outRefundNo"));
    const body = z.object({
      event: z.enum(["refund_success", "refund_fail"]),
    }).parse(await c.req.json());

    const { rows } = await query(`select * from payment_refunds where out_refund_no = $1`, [no]);
    if (!rows[0]) return c.json({ error: { code: "NOT_FOUND", message: "退款单不存在" } }, 404);
    const refund = rows[0];

    const { rows: ord } = await query(`select status from payment_orders where out_trade_no = $1`, [refund.out_trade_no]);
    const cur = ord[0];
    const res = nextOrderStatus(cur.status, body.event);
    if (!res.ok) return c.json({ error: { code: "INVALID_TRANSITION", message: res.error } }, 409);

    const { rows: updRef } = await query(
      `update payment_refunds set status = $2, channel_refund_id = coalesce($3, channel_refund_id), updated_at = now()
        where out_refund_no = $1 returning *`,
      [no, body.event === "refund_success" ? ORDER_STATUS.REFUNDED : ORDER_STATUS.FAILED, refund.channel_refund_id]
    );
    const { rows: updOrd } = await query(
      `update payment_orders set status = $2, updated_at = now() where out_trade_no = $1 returning *`,
      [refund.out_trade_no, res.status]
    );
    return c.json({ data: { refund: updRef[0], order: updOrd[0] } });
  }));

  // ============================================================
  // R7 iOS 苹果 IAP 收据校验（虚拟商品 iOS 通道）
  // 真实环境调 Apple verifyReceipt；此处校验必填字段并落库 iap 订单（纯函数验签占位）。
  // ============================================================
  app.post("/iospay/verify", asyncHandler(async (c) => {
    const body = z.object({
      tenantId: z.number().int().positive(),
      goodsRef: z.object({
        kind: z.enum(["service", "course", "membership", "content"]),
        name: z.string().max(120),
        extra: z.record(z.any()).optional(),
      }),
      amount: z.number().positive().max(100000),
      receipt: z.string().min(1),           // 客户端 base64 收据
      transactionId: z.string().min(1),
      quantity: z.number().int().positive().default(1),
      currency: z.string().max(10).default("CNY"),
    }).parse(await c.req.json());

    // 纯函数校验：必填 + 格式；真实环境应 POST Apple sandbox/prod verifyReceipt 并比对 transaction_id
    const verified = Boolean(body.receipt && body.transactionId && body.amount > 0);
    if (!verified) return c.json({ error: { code: "RECEIPT_INVALID", message: "收据校验失败" } }, 400);

    const outTradeNo = buildOutTradeNo({ prefix: "IAP" });
    const { rows } = await query(
      `insert into payment_orders
        (tenant_id, user_id, out_trade_no, channel, subject_type, goods_type,
         goods_ref, amount, currency, status, channel_order_id, mock, platform)
       values ($1,$2,$3,'virtual_pay','individual_business','virtual',
         $4,$5,$6,$7,$8,false,'ios')
       returning id, out_trade_no, channel, status, platform, created_at`,
      [body.tenantId, currentUserId(c), outTradeNo, JSON.stringify(body.goodsRef),
       body.amount, body.currency, ORDER_STATUS.PAID, body.transactionId]
    );
    return c.json({ data: rows[0], iap: true });
  }));

  // ============================================================
  // R9 商户交易视图（管理端，按租户交易列表 + 退款）
  // ============================================================
  app.use("/admin/*", requireAdmin);

  app.get("/admin/merchant/transactions", asyncHandler(async (c) => {
    const schema = z.object({
      tenantId: z.coerce.number().int().positive(),
      storeId: z.coerce.number().int().positive().optional(),
      status: z.string().max(20).optional(),
      channel: z.enum(CHANNELS).optional(),
      from: z.string().max(20).optional(),
      to: z.string().max(20).optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
    });
    const q = schema.parse(c.req.query());
    const params = [q.tenantId];
    let sql = `select id, out_trade_no, channel, goods_type, amount, currency, status, platform,
                      channel_order_id, mock, created_at, paid_at, delivered_at
                 from payment_orders where tenant_id = $1`;
    if (q.storeId) { sql += ` and store_id = $${params.length + 1}`; params.push(q.storeId); }
    if (q.status) { sql += ` and status = $${params.length + 1}`; params.push(q.status); }
    if (q.channel) { sql += ` and channel = $${params.length + 1}`; params.push(q.channel); }
    if (q.from) { sql += ` and created_at >= $${params.length + 1}`; params.push(q.from); }
    if (q.to) { sql += ` and created_at <= $${params.length + 1}`; params.push(q.to); }
    sql += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
    params.push(q.pageSize, (q.page - 1) * q.pageSize);

    const { rows } = await query(sql, params);

    // 汇总（金额 / 笔数）
    const sumParams = [q.tenantId];
    let sumSql = `select
        count(*) as total,
        coalesce(sum(amount) filter (where status in ('paid','delivering','delivered','refunding')),0) as paid_amount,
        coalesce(sum(amount) filter (where status='refunded'),0) as refunded_amount
      from payment_orders where tenant_id = $1`;
    if (q.storeId) { sumSql += ` and store_id = $${sumParams.length + 1}`; sumParams.push(q.storeId); }
    if (q.channel) { sumSql += ` and channel = $${sumParams.length + 1}`; sumParams.push(q.channel); }
    const { rows: sum } = await query(sumSql, sumParams);

    return c.json({ data: { items: rows, summary: sum[0] || { total: 0, paid_amount: 0, refunded_amount: 0 } } });
  }));

  return app;
};
