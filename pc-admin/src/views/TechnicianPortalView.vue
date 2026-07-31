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
const schedules = ref([]);
const commissions = ref({ summary: { grossAmount: "0.00", commissionAmount: "0.00" }, rows: [] });
const filters = reactive({ date: "", practitionerId: "" });

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

async function loadAll() {
  await guardLoad(async () => {
    await loadBootstrap();
    const queryParams = isAdminMode.value && filters.practitionerId ? { practitionerId: Number(filters.practitionerId) } : {};
    const [summaryData, appointmentRows, scheduleRows, commissionData] = await Promise.all([
      adminApi.technicianSummary(queryParams),
      adminApi.technicianAppointments(queryParams),
      adminApi.technicianSchedules({ ...queryParams, date: filters.date ? filters.date : undefined }),
      adminApi.technicianCommissions(queryParams)
    ]);
    summary.value = {
      profile: summaryData.profile || {},
      cards: { ...summary.value.cards, ...(summaryData.cards || {}) }
    };
    appointments.value = appointmentRows || [];
    schedules.value = scheduleRows || [];
    commissions.value = {
      summary: { ...commissions.value.summary, ...(commissionData.summary || {}) },
      rows: commissionData.rows || []
    };
  });
}

async function loadSchedules() {
  await guardLoad(async () => {
    const queryParams = isAdminMode.value && filters.practitionerId ? { practitionerId: Number(filters.practitionerId) } : {};
    schedules.value = await adminApi.technicianSchedules({ ...queryParams, date: filters.date ? filters.date : undefined });
    summary.value = await adminApi.technicianSummary(queryParams);
  });
}

function resetScheduleFilter() {
  filters.date = "";
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

      <PageSection title="近期预约">
        <DataTable :columns="appointmentColumns" :rows="appointments">
          <template #user="{ row }">{{ row.user_name || '-' }}<br /><small>{{ row.user_phone || '' }}</small></template>
          <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
          <template #amount="{ row }">{{ money(row.amount) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
      </PageSection>

      <PageSection title="我的排班">
        <template #actions>
          <div class="toolbar">
            <el-date-picker v-model="filters.date" value-format="YYYY-MM-DD" placeholder="日期" style="width: 150px" />
            <button class="primary" @click="loadSchedules">查询</button>
            <button class="ghost" @click="resetScheduleFilter">重置</button>
            <button class="primary" @click="openScheduleEditor">新增排班</button>
          </div>
        </template>
        <DataTable :columns="scheduleColumns" :rows="schedules">
          <template #work_date="{ row }">{{ dateText(row.work_date) }}</template>
          <template #time="{ row }">{{ timeText(row.start_time) }}-{{ timeText(row.end_time) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
      </PageSection>

      <PageSection title="我的提成">
        <div class="metric-grid compact-grid">
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
      </PageSection>
    </template>

    <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
  </div>
</template>
