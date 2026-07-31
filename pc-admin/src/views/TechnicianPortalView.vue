<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { bootstrapState, loadBootstrap } from "../composables/useBootstrap";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { dateText, money, percentText, timeText } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });

const loading = ref(false);
const permissionDenied = ref(false);
const summary = ref({
  profile: {},
  cards: { todayAppointments: 0, futureSchedules: 0, grossAmount: "0.00", commissionAmount: "0.00" }
});

const appointments = ref([]);
const appointmentPage = ref(1);
const appointmentTotal = ref(0);

const schedules = ref([]);
const schedulePage = ref(1);
const scheduleTotal = ref(0);
const filters = reactive({ date: "", practitionerId: "" });

const commissions = ref({ summary: { grossAmount: "0.00", commissionAmount: "0.00" }, rows: [] });
const commissionPage = ref(1);
const commissionTotal = ref(0);

const practitionerOptions = computed(() => bootstrapState.practitioners.map((item) => ({ label: item.name, value: Number(item.id) })));
const isAdminMode = computed(() => !!props.showToast);

const profile = computed(() => summary.value.profile || {});
const cards = computed(() => summary.value.cards || {});
const cardItems = computed(() => [
  { label: "今日预约", value: cards.value.todayAppointments || 0 },
  { label: "未来可约排班", value: cards.value.futureSchedules || 0 },
  { label: "服务业绩", value: money(cards.value.grossAmount) },
  { label: "预估提成", value: money(cards.value.commissionAmount) }
]);

const tabs = [
  { key: "appointments", label: "近期预约", icon: "📋" },
  { key: "schedules", label: "我的排班", icon: "📅" },
  { key: "commissions", label: "我的提成", icon: "💰" }
];
const activeTab = ref("appointments");

const appointmentColumns = [
  { key: "order_no", label: "订单号" },
  { key: "user", label: "用户" },
  { key: "service_name", label: "项目" },
  { key: "store_name", label: "门店" },
  { key: "time", label: "时间" },
  { key: "amount", label: "金额" },
  { key: "status", label: "状态" }
];

const scheduleColumns = [
  { key: "work_date", label: "日期" },
  { key: "time", label: "时间" },
  { key: "store_name", label: "门店" },
  { key: "capacity", label: "容量" },
  { key: "booked_count", label: "已约" },
  { key: "status", label: "状态" }
];

const commissionColumns = [
  { key: "order_no", label: "订单号" },
  { key: "service_name", label: "项目" },
  { key: "time", label: "时间" },
  { key: "gross_amount", label: "业绩" },
  { key: "rate", label: "比例" },
  { key: "commission_amount", label: "提成" },
  { key: "status", label: "状态" }
];

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: loadSchedules, showToast: props.showToast });

function today(offset = 0) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

async function guardLoad(loader) {
  loading.value = true;
  permissionDenied.value = false;
  try {
    await loader();
  } catch (error) {
    if (error.message?.includes("技师端权限") || error.message?.includes("403")) {
      permissionDenied.value = true;
      props.showToast?.("当前账号暂无技师端权限");
      return;
    }
    props.showToast?.(error.message || "技师工作台加载失败");
  } finally {
    loading.value = false;
  }
}

function queryParams() {
  return isAdminMode.value && filters.practitionerId ? { practitionerId: Number(filters.practitionerId) } : {};
}

async function loadSummary() {
  const data = await adminApi.technicianSummary(queryParams());
  summary.value = {
    profile: data.profile || {},
    cards: { ...summary.value.cards, ...(data.cards || {}) }
  };
}

async function loadAppointments() {
  const result = await adminApi.technicianAppointments({ ...queryParams(), page: appointmentPage.value, pageSize: 10 });
  appointments.value = result.data || [];
  appointmentTotal.value = result.pagination?.total || 0;
}

async function loadSchedules() {
  const result = await adminApi.technicianSchedules({ ...queryParams(), date: filters.date ? filters.date : undefined, page: schedulePage.value, pageSize: 10 });
  schedules.value = result.data || [];
  scheduleTotal.value = result.pagination?.total || 0;
}

async function loadCommissions() {
  const result = await adminApi.technicianCommissions({ ...queryParams(), page: commissionPage.value, pageSize: 10 });
  commissions.value = result.data || { summary: { grossAmount: "0.00", commissionAmount: "0.00" }, rows: [] };
  commissionTotal.value = result.pagination?.total || 0;
}

async function loadAll() {
  appointmentPage.value = 1;
  schedulePage.value = 1;
  commissionPage.value = 1;
  await guardLoad(async () => {
    await loadBootstrap();
    await Promise.all([loadSummary(), loadAppointments(), loadSchedules(), loadCommissions()]);
  });
}

async function loadActiveTab() {
  if (activeTab.value === "appointments") await loadAppointments();
  else if (activeTab.value === "schedules") await loadSchedules();
  else if (activeTab.value === "commissions") await loadCommissions();
}

function onTabChange(key) {
  activeTab.value = key;
  if (key === "appointments") { appointmentPage.value = 1; loadAppointments(); }
  else if (key === "schedules") { schedulePage.value = 1; loadSchedules(); }
  else if (key === "commissions") { commissionPage.value = 1; loadCommissions(); }
}

function resetScheduleFilter() {
  filters.date = "";
  schedulePage.value = 1;
  loadSchedules();
}

function openScheduleEditor() {
  openEditor({
    title: "新增我的排班",
    model: {
      storeId: props.storeId ? Number(props.storeId) : "",
      workDate: today(),
      startTime: "09:30",
      endTime: "10:30",
      capacity: 1,
      status: "open"
    },
    fields: [
      { name: "workDate", label: "日期", type: "date" },
      { name: "startTime", label: "开始时间", type: "time" },
      { name: "endTime", label: "结束时间", type: "time" },
      { name: "capacity", label: "容量", type: "number" },
      { name: "status", label: "状态", type: "select", options: statusOptions.schedule }
    ],
    submit: adminApi.saveTechnicianSchedule
  });
}

onMounted(loadAll);
</script>

<template>
  <div class="technician-portal">
    <section class="profile-panel">
      <div>
        <p class="eyebrow">TECHNICIAN PORTAL</p>
        <h2>{{ profile.name || "技师工作台" }}</h2>
        <p>{{ profile.title || "-" }} · {{ profile.store_name || "未绑定门店" }}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <el-select v-if="isAdminMode" v-model="filters.practitionerId" filterable clearable placeholder="切换技师" style="width: 180px" @change="loadAll">
          <el-option v-for="item in practitionerOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <StatusPill :value="profile.status || 'active'" />
      </div>
    </section>

    <div v-if="permissionDenied" class="empty">当前账号暂无技师端权限</div>
    <div v-else-if="loading" class="empty">正在加载技师工作台...</div>

    <template v-else>
      <div class="metric-grid compact-grid">
        <div v-for="item in cardItems" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div class="tab-bar">
        <button v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: activeTab === tab.key }" @click="onTabChange(tab.key)">
          <span>{{ tab.icon }}</span> {{ tab.label }}
        </button>
      </div>

      <PageSection v-if="activeTab === 'appointments'" title="近期预约">
        <DataTable :columns="appointmentColumns" :rows="appointments">
          <template #user="{ row }">{{ row.user_name || '-' }}<br /><small>{{ row.user_phone || '' }}</small></template>
          <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
          <template #amount="{ row }">{{ money(row.amount) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
        <div v-if="appointmentTotal > 10" style="margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; align-items: center;">
          <button class="ghost mini" :disabled="appointmentPage <= 1" @click="appointmentPage--; loadAppointments()">上一页</button>
          <span style="font-size: 13px; color: var(--muted);">{{ appointmentPage }} / {{ Math.ceil(appointmentTotal / 10) }}</span>
          <button class="ghost mini" :disabled="appointmentPage >= Math.ceil(appointmentTotal / 10)" @click="appointmentPage++; loadAppointments()">下一页</button>
        </div>
      </PageSection>

      <PageSection v-if="activeTab === 'schedules'" title="我的排班">
        <template #actions>
          <div class="toolbar">
            <el-date-picker v-model="filters.date" value-format="YYYY-MM-DD" placeholder="日期" style="width: 150px" />
            <button class="primary" @click="schedulePage = 1; loadSchedules()">查询</button>
            <button class="ghost" @click="resetScheduleFilter">重置</button>
            <button class="primary" @click="openScheduleEditor">新增排班</button>
          </div>
        </template>
        <DataTable :columns="scheduleColumns" :rows="schedules">
          <template #work_date="{ row }">{{ dateText(row.work_date) }}</template>
          <template #time="{ row }">{{ timeText(row.start_time) }}-{{ timeText(row.end_time) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
        <div v-if="scheduleTotal > 10" style="margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; align-items: center;">
          <button class="ghost mini" :disabled="schedulePage <= 1" @click="schedulePage--; loadSchedules()">上一页</button>
          <span style="font-size: 13px; color: var(--muted);">{{ schedulePage }} / {{ Math.ceil(scheduleTotal / 10) }}</span>
          <button class="ghost mini" :disabled="schedulePage >= Math.ceil(scheduleTotal / 10)" @click="schedulePage++; loadSchedules()">下一页</button>
        </div>
      </PageSection>

      <PageSection v-if="activeTab === 'commissions'" title="我的提成">
        <div class="metric-grid compact-grid" style="margin-bottom: 14px;">
          <div class="metric-card">
            <span>服务业绩</span>
            <strong>{{ money(commissions.summary.grossAmount) }}</strong>
          </div>
          <div class="metric-card">
            <span>预估提成</span>
            <strong>{{ money(commissions.summary.commissionAmount) }}</strong>
          </div>
        </div>
        <DataTable :columns="commissionColumns" :rows="commissions.rows">
          <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
          <template #gross_amount="{ row }">{{ money(row.gross_amount) }}</template>
          <template #rate="{ row }">{{ percentText(row.rate) }}</template>
          <template #commission_amount="{ row }">{{ money(row.commission_amount) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
        <div v-if="commissionTotal > 10" style="margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; align-items: center;">
          <button class="ghost mini" :disabled="commissionPage <= 1" @click="commissionPage--; loadCommissions()">上一页</button>
          <span style="font-size: 13px; color: var(--muted);">{{ commissionPage }} / {{ Math.ceil(commissionTotal / 10) }}</span>
          <button class="ghost mini" :disabled="commissionPage >= Math.ceil(commissionTotal / 10)" @click="commissionPage++; loadCommissions()">下一页</button>
        </div>
      </PageSection>
    </template>

    <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
  </div>
</template>
