<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { adminApi } from "@tcm-clinic/admin-shared/uni";
import { navItems } from "@tcm-clinic/admin-shared/constants";
import { dateText, money, percentText, statusLabel, timeText } from "@tcm-clinic/admin-shared/format";
import { bootstrapState, loadBootstrap } from "../../shared/bootstrap";
import { createModuleConfigs } from "./module-configs";

const activeKey = ref("dashboard");
const storeId = ref("");
const loading = ref(false);
const rows = ref([]);
const extraRows = ref([]);
const emptyDashboard = () => ({ cards: {}, storeRank: [], practitionerRank: [], serviceRank: [], commissions: [] });
const dashboard = ref(emptyDashboard());
const toast = ref("");
const editor = reactive({ visible: false, title: "", fields: [], model: {}, save: null });

const moduleConfigs = computed(() => createModuleConfigs({ bootstrap: bootstrapState, storeId, extraRows }));
const activeNav = computed(() => navItems.find((item) => item.key === activeKey.value) || navItems[0]);
const currentConfig = computed(() => moduleConfigs.value[activeKey.value]);
const storeOptions = computed(() => [{ id: "", name: "全部门店" }, ...bootstrapState.stores]);
const combinedRows = computed(() => [...rows.value, ...extraRows.value]);
const hasHeadActions = computed(() => Boolean(currentConfig.value?.primary || currentConfig.value?.secondary));

function showToast(message) {
  toast.value = message;
  setTimeout(() => {
    if (toast.value === message) toast.value = "";
  }, 1800);
}

async function runLoad(loader) {
  loading.value = true;
  try {
    await loader();
  } catch (error) {
    showToast(error.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadDashboard() {
  const data = await adminApi.dashboard({ storeId: storeId.value });
  dashboard.value = {
    ...emptyDashboard(),
    ...(data && typeof data === "object" ? data : {})
  };
}

async function loadSpecialModule(key) {
  if (key === "orders") {
    rows.value = await adminApi.orders({ storeId: storeId.value });
    return;
  }
  if (key === "content") {
    const [activities, articles] = await Promise.all([
      adminApi.activities({ storeId: storeId.value }),
      adminApi.articles({ storeId: storeId.value })
    ]);
    rows.value = activities.map((item) => ({ ...item, _type: "活动" }));
    extraRows.value = articles.map((item) => ({ ...item, _type: "文章" }));
    return;
  }
  if (key === "reviews") {
    rows.value = await adminApi.reviews();
    return;
  }
  if (key === "audit") {
    rows.value = await adminApi.auditLogs();
    return;
  }
}

async function loadActive() {
  await runLoad(async () => {
    extraRows.value = [];
    if (activeKey.value === "dashboard") {
      await loadDashboard();
      return;
    }
    if (currentConfig.value) {
      await loadBootstrap();
      rows.value = await currentConfig.value.load();
      return;
    }
    await loadSpecialModule(activeKey.value);
  });
}

function switchModule(key) {
  if (activeKey.value === key) return;
  activeKey.value = key;
}

function isActiveModule(key) {
  return activeKey.value === key;
}

function tabClass(key) {
  return isActiveModule(key) ? "tab active" : "tab";
}

function tabKey(key) {
  return `${activeKey.value}-${key}`;
}

function cycleStore() {
  const options = storeOptions.value;
  const currentIndex = options.findIndex((item) => item.id === storeId.value);
  const next = options[(currentIndex + 1) % options.length];
  storeId.value = next?.id || "";
}

function openEditor(row = {}) {
  const config = currentConfig.value;
  if (!config) return;
  editor.title = row.id ? `编辑${config.title}` : config.primary;
  editor.fields = config.fields();
  editor.model = config.model(row);
  editor.save = config.save;
  editor.visible = true;
}

function openSecondaryEditor() {
  const secondary = currentConfig.value?.secondaryEditor;
  if (!secondary) return;
  editor.title = secondary.title;
  editor.fields = secondary.fields();
  editor.model = secondary.model();
  editor.save = secondary.save;
  editor.visible = true;
}

function updateField(field, value) {
  editor.model[field.name] = field.type === "number" ? Number(value) : value;
}

function updateSelect(field, event) {
  const option = field.options[Number(event.detail.value)];
  editor.model[field.name] = option?.value ?? "";
}

function updateChecks(field, event) {
  editor.model[field.name] = event.detail.value.map(Number);
}

async function saveEditor() {
  await runLoad(async () => {
    await editor.save(editor.model);
    editor.visible = false;
    showToast("保存成功");
    await loadActive();
  });
}

async function updateOrder(row, status) {
  await runLoad(async () => {
    await adminApi.updateOrderStatus(row.id, status);
    showToast("订单状态已更新");
    await loadActive();
  });
}

function cardTitle(row) {
  return row.name || row.title || row.order_no || row.nickname || row.user_name || row.action || "未命名记录";
}

function cardMeta(row) {
  if (activeKey.value === "orders") return `${row.service_name || "-"} · ${dateText(row.appointment_date)} ${timeText(row.start_time)}`;
  if (activeKey.value === "schedules") return `${dateText(row.work_date)} ${timeText(row.start_time)}-${timeText(row.end_time)}`;
  if (activeKey.value === "commissions") return `${row.practitioner_name || "全部技师"} · ${row.service_name || "全部项目"}`;
  if (activeKey.value === "content") return `${row._type} · ${row.store_name || "通用"}`;
  if (activeKey.value === "audit") return `${row.user_name || "-"} · ${row.target_type || "-"} #${row.target_id || ""}`;
  return row.store_name || row.city || row.phone || row.category || row.member_level || row.practitioner_name || "";
}

function cardValue(row) {
  if (activeKey.value === "orders") return money(row.amount);
  if (activeKey.value === "services") return money(row.price);
  if (activeKey.value === "commissions") return percentText(row.rate);
  if (activeKey.value === "users") return money(row.total_spend);
  if (activeKey.value === "reviews") return "★".repeat(row.rating || 0);
  return statusLabel(row.status ?? row.is_active ?? row.can_manage);
}

function cardDetail(row) {
  if (activeKey.value === "orders") return `${row.user_name || "-"} ${row.user_phone || ""}，${row.store_name || "-"}，${row.practitioner_name || "-"}`;
  if (activeKey.value === "practitioners") return `${row.title || ""} ${(row.specialties || []).join("、")}`;
  if (activeKey.value === "homepage") return JSON.stringify(row.payload || {});
  if (activeKey.value === "audit") return JSON.stringify(row.detail || {});
  return row.description || row.subtitle || row.summary || row.address || row.content || "";
}

onMounted(async () => {
  await loadBootstrap();
  await loadActive();
});

watch([activeKey, storeId], loadActive);
</script>

<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="eyebrow">TCM MOBILE OPS</text>
        <text class="title">青囊掌柜台</text>
        <text class="subtitle">一套后台，多端发布：H5 / 支付宝 / 抖音小程序</text>
      </view>
      <view class="seal">青</view>
    </view>

    <view class="toolbar">
      <view class="store-picker" @tap="cycleStore">
        {{ storeOptions.find((item) => item.id === storeId)?.name || "全部门店" }}
      </view>
      <view class="refresh" @tap="loadActive">刷新</view>
    </view>

    <view class="tabs">
      <view
        v-for="item in navItems"
        :key="tabKey(item.key)"
        :class="tabClass(item.key)"
        @click="switchModule(item.key)"
        @tap="switchModule(item.key)"
      >
        {{ item.label }}
      </view>
    </view>

    <view v-if="loading" class="loading">正在调取经营脉络...</view>

    <view v-else-if="activeKey === 'dashboard'" class="dashboard">
      <view class="metric-grid">
        <view class="metric-card">
          <text>营业额</text>
          <text class="metric-value">{{ money(dashboard.cards.revenue) }}</text>
        </view>
        <view class="metric-card">
          <text>预约订单</text>
          <text class="metric-value">{{ dashboard.cards.orders || 0 }}</text>
        </view>
        <view class="metric-card">
          <text>服务用户</text>
          <text class="metric-value">{{ dashboard.cards.served_users || 0 }}</text>
        </view>
        <view class="metric-card">
          <text>客单价</text>
          <text class="metric-value">{{ money(dashboard.cards.avg_order) }}</text>
        </view>
      </view>

      <view class="rank-card">
        <text class="section-title">门店收入排行</text>
        <view v-for="item in dashboard.storeRank" :key="item.store_name" class="rank-row">
          <text>{{ item.store_name }}</text>
          <text class="rank-value">{{ money(item.revenue) }}</text>
        </view>
      </view>

      <view class="rank-card">
        <text class="section-title">技师业绩排行</text>
        <view v-for="item in dashboard.practitionerRank" :key="item.practitioner_name" class="rank-row">
          <text>{{ item.practitioner_name }}</text>
          <text class="rank-value">{{ money(item.revenue) }}</text>
        </view>
      </view>
    </view>

    <view v-else class="module">
      <view class="module-head">
        <view>
          <text class="section-title">{{ activeNav.label }}</text>
          <text class="module-count">共 {{ rows.length + extraRows.length }} 条记录</text>
        </view>
        <view v-if="hasHeadActions" class="head-actions">
          <view v-if="currentConfig && currentConfig.primary" class="primary" @tap="openEditor()">
            {{ currentConfig.primary }}
          </view>
          <view v-if="currentConfig && currentConfig.secondary" class="ghost" @tap="openSecondaryEditor">
            {{ currentConfig.secondary }}
          </view>
        </view>
      </view>

      <view v-if="!rows.length && !extraRows.length" class="empty">暂无数据</view>

      <view v-for="row in combinedRows" :key="`${row._type || activeKey}-${row.id}`" class="record-card">
        <view class="record-main">
          <view>
            <text class="record-title">{{ cardTitle(row) }}</text>
            <text class="record-meta">{{ cardMeta(row) }}</text>
          </view>
          <text class="record-value">{{ cardValue(row) }}</text>
        </view>
        <text v-if="cardDetail(row)" class="record-detail">{{ cardDetail(row) }}</text>
        <view class="record-actions">
          <view v-if="currentConfig && activeKey !== 'schedules' && activeKey !== 'content'" class="ghost mini" @tap="openEditor(row)">编辑</view>
          <view v-if="activeKey === 'orders'" class="order-actions">
            <view class="ghost mini" @tap="updateOrder(row, 'confirmed')">确认</view>
            <view class="primary mini" @tap="updateOrder(row, 'completed')">核销</view>
            <view class="danger mini" @tap="updateOrder(row, 'cancelled')">取消</view>
          </view>
        </view>
      </view>

      <view v-if="activeKey === 'commissions' && extraRows.length" class="rank-card">
        <text class="section-title">本期提成预估</text>
        <view v-for="item in extraRows" :key="item.practitioner_name" class="rank-row">
          <text>{{ item.practitioner_name }}</text>
          <text class="rank-value">{{ money(item.commission_amount) }}</text>
        </view>
      </view>
    </view>

    <view v-if="editor.visible" class="sheet-mask" @tap="editor.visible = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <text>{{ editor.title }}</text>
          <view class="ghost mini" @tap="editor.visible = false">关闭</view>
        </view>
        <view v-for="field in editor.fields" :key="field.name" class="field">
          <text class="field-label">{{ field.label }}</text>
          <picker v-if="field.type === 'select'" :range="field.options" range-key="label" @change="updateSelect(field, $event)">
            <view class="select-box">{{ field.options.find((item) => item.value === editor.model[field.name])?.label || "请选择" }}</view>
          </picker>
          <checkbox-group
            v-else-if="field.type === 'checks'"
            class="checks"
            @change="updateChecks(field, $event)"
          >
            <label v-for="option in field.options" :key="option.value" class="check-item">
              <checkbox
                :value="String(option.value)"
                :checked="(editor.model[field.name] || []).includes(option.value)"
                color="#264f3a"
              />
              <text>{{ option.label }}</text>
            </label>
          </checkbox-group>
          <textarea
            v-else-if="field.type === 'textarea'"
            v-model="editor.model[field.name]"
            class="textarea"
            auto-height
          />
          <input
            v-else
            class="input"
            :type="field.type === 'number' ? 'digit' : 'text'"
            :value="editor.model[field.name]"
            @input="updateField(field, $event.detail.value)"
          />
        </view>
        <view class="save" @tap="saveEditor">保存</view>
      </view>
    </view>

    <view v-if="toast" class="toast">{{ toast }}</view>
  </view>
</template>

<style src="./index.css"></style>
