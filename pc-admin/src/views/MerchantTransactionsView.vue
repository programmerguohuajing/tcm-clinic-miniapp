<script setup>
import { onMounted, reactive, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import PageSection from "../components/PageSection.vue";
import { adminApi } from "../services/adminApi";

const tenantId = ref(null);
const rows = ref([]);
const summary = ref({ total: 0, paid_amount: 0, refunded_amount: 0 });
const loading = ref(false);
const filters = reactive({ status: "", channel: "" });

const channelOptions = [
  { label: "微信支付", value: "wechat" },
  { label: "虚拟支付", value: "virtual" },
  { label: "iOS IAP", value: "ios" }
];
const statusOptions = [
  { label: "待支付", value: "pending" },
  { label: "已支付", value: "paid" },
  { label: "发货中", value: "delivering" },
  { label: "已发货", value: "delivered" },
  { label: "退款中", value: "refunding" },
  { label: "已退款", value: "refunded" },
  { label: "已取消", value: "cancelled" }
];
const statusLabelMap = {
  pending: "待支付", paid: "已支付", delivering: "发货中", delivered: "已发货",
  refunding: "退款中", refunded: "已退款", cancelled: "已取消"
};
const refundable = new Set(["paid", "delivering", "delivered", "refunding"]);

const refunding = ref(null);
const refundForm = reactive({ reason: "" });

async function ensureTenant() {
  if (tenantId.value) return;
  const tenants = await adminApi.tenants();
  tenantId.value = (tenants && tenants[0] && tenants[0].id) || null;
}

async function load() {
  await ensureTenant();
  if (!tenantId.value) return;
  loading.value = true;
  try {
    const res = await adminApi.merchantTransactions({
      tenantId: tenantId.value,
      status: filters.status || undefined,
      channel: filters.channel || undefined
    });
    rows.value = res.items || [];
    summary.value = res.summary || { total: 0, paid_amount: 0, refunded_amount: 0 };
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.status = "";
  filters.channel = "";
  load();
}

function openRefund(row) {
  refunding.value = row;
  refundForm.reason = "";
}

async function submitRefund() {
  if (!refunding.value) return;
  try {
    await adminApi.createRefund({
      outTradeNo: refunding.value.out_trade_no,
      amount: refunding.value.amount,
      reason: refundForm.reason || "用户申请退款"
    });
    refunding.value = null;
    load();
  } catch (e) {
    alert(e.message || "退款发起失败");
  }
}

function fmtYuan(v) {
  const n = Number(v || 0) / 100;
  return "¥" + n.toFixed(2);
}

onMounted(load);
</script>

<template>
  <PageSection title="商户交易">
    <template #actions>
      <div class="summary-cards">
        <div class="stat"><span>订单数</span><strong>{{ summary.total || 0 }}</strong></div>
        <div class="stat"><span>有效金额</span><strong>{{ fmtYuan(summary.paid_amount) }}</strong></div>
        <div class="stat"><span>已退款</span><strong>{{ fmtYuan(summary.refunded_amount) }}</strong></div>
      </div>
    </template>

    <div class="toolbar" style="margin-bottom: 12px">
      <el-select v-model="filters.channel" clearable placeholder="支付渠道" style="width: 140px">
        <el-option v-for="item in channelOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="filters.status" clearable placeholder="订单状态" style="width: 140px">
        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <button class="primary" @click="load">查询</button>
      <button class="ghost" @click="resetFilters">重置</button>
    </div>

    <DataTable
      :columns="[
        { key: 'out_trade_no', label: '商户单号' },
        { key: 'channel', label: '渠道' },
        { key: 'goods_type', label: '商品类型' },
        { key: 'amount', label: '金额' },
        { key: 'status', label: '状态' },
        { key: 'paid_at', label: '支付时间' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
      :loading="loading"
    >
      <template #channel="{ row }">
        <span class="tag">{{ row.channel }}</span>
        <span v-if="row.mock" class="tag tag-mock">mock</span>
      </template>
      <template #amount="{ row }">{{ fmtYuan(row.amount) }}</template>
      <template #status="{ row }"><span class="status-text">{{ statusLabelMap[row.status] || row.status }}</span></template>
      <template #actions="{ row }">
        <button v-if="refundable.has(row.status)" class="ghost mini" @click="openRefund(row)">退款</button>
        <span v-else class="muted">—</span>
      </template>
    </DataTable>

    <div v-if="refunding" class="dialog-mask" @click.self="refunding = null">
      <div class="dialog">
        <h3>发起退款</h3>
        <p class="muted">单号 {{ refunding.out_trade_no }} · 金额 {{ fmtYuan(refunding.amount) }}</p>
        <label>退款原因</label>
        <textarea v-model="refundForm.reason" rows="3" placeholder="用户申请退款"></textarea>
        <div class="dialog-actions">
          <button class="ghost" @click="refunding = null">取消</button>
          <button class="primary" @click="submitRefund">确认退款</button>
        </div>
      </div>
    </div>
  </PageSection>
</template>

<style scoped>
.summary-cards { display: flex; gap: 16px; }
.stat { display: flex; flex-direction: column; line-height: 1.3; }
.stat span { font-size: 12px; color: #8a6d4b; }
.stat strong { font-size: 18px; color: #2b2118; }
.tag { display: inline-block; font-size: 12px; padding: 1px 6px; border: 1px solid #e3d3bf; border-radius: 4px; color: #6b4f2a; }
.tag-mock { border-color: #d8c9b2; color: #9a866a; background: #f6efe3; }
.status-text { font-weight: 600; color: #2b2118; }
.muted { color: #99836a; }
.dialog-mask { position: fixed; inset: 0; background: rgba(40,30,20,.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
.dialog { background: #fff; width: 420px; max-width: 92vw; border-radius: 10px; padding: 20px 22px; box-shadow: 0 12px 40px rgba(0,0,0,.18); }
.dialog h3 { margin: 0 0 6px; color: #2b2118; }
.dialog label { display: block; font-size: 13px; color: #6b4f2a; margin: 12px 0 6px; }
.dialog textarea { width: 100%; border: 1px solid #e0d2bd; border-radius: 6px; padding: 8px; resize: vertical; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
</style>
