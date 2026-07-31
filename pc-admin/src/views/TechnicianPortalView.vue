<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
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

/* ---------- state ---------- */
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
const activeTab = ref("appointments");

/* ---------- computed ---------- */
const practitionerOptions = computed(() => bootstrapState.practitioners.map((item) => ({ label: item.name, value: Number(item.id) })));
const isAdminMode = computed(() => !!props.showToast);
const profile = computed(() => summary.value.profile || {});
const cards = computed(() => summary.value.cards || {});

const initials = computed(() => (profile.value.name || "").slice(0, 1));

/* ---------- columns ---------- */
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

/* ---------- schedule editor ---------- */
const { editor, openEditor, saveEditor } = useCrudEditor({
  onSaved: () => { schedulePage.value = 1; loadSchedules(); },
  showToast: props.showToast
});

function today(offset = 0) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

/* ---------- data loading ---------- */
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
  appointments.value = result.rows || [];
  appointmentTotal.value = result.total || 0;
}

async function loadSchedules() {
  const result = await adminApi.technicianSchedules({
    ...queryParams(),
    date: filters.date || undefined,
    page: schedulePage.value,
    pageSize: 10
  });
  schedules.value = result.rows || [];
  scheduleTotal.value = result.total || 0;
}

async function loadCommissions() {
  const result = await adminApi.technicianCommissions({ ...queryParams(), page: commissionPage.value, pageSize: 10 });
  commissions.value = result || { summary: { grossAmount: "0.00", commissionAmount: "0.00" }, rows: [] };
  commissionTotal.value = result.total || 0;
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
  appointmentPage.value = 1;
  schedulePage.value = 1;
  commissionPage.value = 1;
  await guardLoad(async () => {
    await loadBootstrap();
    await Promise.all([loadSummary(), loadAppointments(), loadSchedules(), loadCommissions()]);
  });
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
    submit: (model) => adminApi.saveTechnicianSchedule({ ...model, practitionerId: Number(filters.practitionerId) })
  });
}

function onPractitionerSwitch() {
  loadAll();
}

/* ---------- pagination ---------- */
function paginate(type, delta) {
  if (type === "appointments") { appointmentPage.value += delta; loadAppointments(); }
  else if (type === "schedules") { schedulePage.value += delta; loadSchedules(); }
  else if (type === "commissions") { commissionPage.value += delta; loadCommissions(); }
}
function pageOf(type) {
  if (type === "appointments") return appointmentPage.value;
  if (type === "schedules") return schedulePage.value;
  return commissionPage.value;
}
function totalOf(type) {
  if (type === "appointments") return appointmentTotal.value;
  if (type === "schedules") return scheduleTotal.value;
  return commissionTotal.value;
}

/* ---------- life cycle ---------- */
onMounted(async () => {
  await loadBootstrap();
  if (isAdminMode.value && !filters.practitionerId && practitionerOptions.value.length) {
    filters.practitionerId = practitionerOptions.value[0].value;
  }
  loadAll();
});

watch(() => bootstrapState.practitioners, (list) => {
  if (isAdminMode.value && !filters.practitionerId && list.length) {
    filters.practitionerId = Number(list[0].id);
  }
});
</script>

<template>
  <div class="view">
    <!-- ===== 技师资料卡 ===== -->
    <div class="card tp-profile">
      <div class="tp-profile__inner">
        <div class="tp-profile__info">
          <div class="avatar">{{ initials }}</div>
          <div>
            <h2>{{ profile.name || "技师工作台" }}</h2>
            <p>{{ profile.title || "-" }} · {{ profile.store_name || "未绑定门店" }}</p>
          </div>
        </div>
        <div class="tp-profile__right">
          <el-select
            v-if="isAdminMode"
            v-model="filters.practitionerId"
            filterable
            clearable
            placeholder="切换技师"
            style="width: 180px"
            @change="onPractitionerSwitch"
          >
            <el-option v-for="item in practitionerOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <StatusPill :value="profile.status || 'active'" />
        </div>
      </div>
    </div>

    <div v-if="permissionDenied" class="empty">当前账号暂无技师端权限</div>
    <div v-else-if="loading" class="empty">正在加载技师工作台...</div>

    <template v-else>
      <!-- ===== 指标卡 ===== -->
      <div class="tp-metrics">
        <div class="tp-metric">
          <div class="tp-metric__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="tp-metric__body">
            <span class="tp-metric__label">今日预约</span>
            <strong class="tp-metric__value">{{ cards.todayAppointments || 0 }}</strong>
          </div>
        </div>
        <div class="tp-metric">
          <div class="tp-metric__icon tp-metric__icon--green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="tp-metric__body">
            <span class="tp-metric__label">未来可约排班</span>
            <strong class="tp-metric__value">{{ cards.futureSchedules || 0 }}</strong>
          </div>
        </div>
        <div class="tp-metric">
          <div class="tp-metric__icon tp-metric__icon--cyan">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="tp-metric__body">
            <span class="tp-metric__label">服务业绩</span>
            <strong class="tp-metric__value">{{ money(cards.grossAmount) }}</strong>
          </div>
        </div>
        <div class="tp-metric">
          <div class="tp-metric__icon tp-metric__icon--amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div class="tp-metric__body">
            <span class="tp-metric__label">预估提成</span>
            <strong class="tp-metric__value">{{ money(cards.commissionAmount) }}</strong>
          </div>
        </div>
      </div>

      <!-- ===== 标签页 ===== -->
      <div class="tabbar">
        <button
          v-for="tab in [{ key: 'appointments', label: '近期预约' }, { key: 'schedules', label: '我的排班' }, { key: 'commissions', label: '我的提成' }]"
          :key="tab.key"
          class="page-tab"
          :class="{ active: activeTab === tab.key }"
          @click="onTabChange(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ===== 近期预约 ===== -->
      <PageSection v-show="activeTab === 'appointments'" title="近期预约">
        <DataTable :columns="appointmentColumns" :rows="appointments">
          <template #user="{ row }">{{ row.user_name || '-' }}<br /><small>{{ row.user_phone || '' }}</small></template>
          <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
          <template #amount="{ row }">{{ money(row.amount) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
        <Pagination
          v-if="appointmentTotal > 10"
          :page="appointmentPage"
          :total="appointmentTotal"
          @prev="paginate('appointments', -1)"
          @next="paginate('appointments', 1)"
        />
      </PageSection>

      <!-- ===== 我的排班 ===== -->
      <PageSection v-show="activeTab === 'schedules'" title="我的排班">
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
        <Pagination
          v-if="scheduleTotal > 10"
          :page="schedulePage"
          :total="scheduleTotal"
          @prev="paginate('schedules', -1)"
          @next="paginate('schedules', 1)"
        />
      </PageSection>

      <!-- ===== 我的提成 ===== -->
      <PageSection v-show="activeTab === 'commissions'" title="我的提成">
        <div class="tp-metrics" style="margin-bottom: 16px;">
          <div class="tp-metric">
            <div class="tp-metric__icon tp-metric__icon--cyan">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div class="tp-metric__body">
              <span class="tp-metric__label">服务业绩</span>
              <strong class="tp-metric__value">{{ money(commissions.summary.grossAmount) }}</strong>
            </div>
          </div>
          <div class="tp-metric">
            <div class="tp-metric__icon tp-metric__icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div class="tp-metric__body">
              <span class="tp-metric__label">预估提成</span>
              <strong class="tp-metric__value" style="color: var(--green);">{{ money(commissions.summary.commissionAmount) }}</strong>
            </div>
          </div>
        </div>
        <DataTable :columns="commissionColumns" :rows="commissions.rows">
          <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
          <template #gross_amount="{ row }">{{ money(row.gross_amount) }}</template>
          <template #rate="{ row }">{{ percentText(row.rate) }}</template>
          <template #commission_amount="{ row }">{{ money(row.commission_amount) }}</template>
          <template #status="{ row }"><StatusPill :value="row.status" /></template>
        </DataTable>
        <Pagination
          v-if="commissionTotal > 10"
          :page="commissionPage"
          :total="commissionTotal"
          @prev="paginate('commissions', -1)"
          @next="paginate('commissions', 1)"
        />
      </PageSection>
    </template>

    <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
  </div>
</template>

<!-- ========== 翻页组件 ========== -->
<script>
import { computed } from "vue";
const Pagination = {
  props: {
    page: { type: Number, required: true },
    total: { type: Number, required: true },
    pageSize: { type: Number, default: 10 }
  },
  emits: ["prev", "next"],
  setup(props) {
    const maxPage = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
    return { maxPage };
  },
  template: `
    <div v-if="total > pageSize" class="tp-pagination">
      <button class="ghost mini" :disabled="page <= 1" @click="$emit('prev')">上一页</button>
      <span>{{ page }} / {{ maxPage }}</span>
      <button class="ghost mini" :disabled="page >= maxPage" @click="$emit('next')">下一页</button>
    </div>
  `
};
</script>

<style scoped>
/* ===== 技师工作台 ===== */

/* 资料卡 */
.tp-profile {
  background:
    radial-gradient(circle at 88% 12%, rgba(52, 120, 246, 0.08), transparent 42%),
    var(--panel);
}
.tp-profile__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.tp-profile__info {
  display: flex;
  align-items: center;
  gap: 14px;
}
.tp-profile__info .avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--blue), var(--cyan));
  letter-spacing: 1px;
}
.tp-profile__info h2 {
  font-size: 17px;
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 2px;
}
.tp-profile__info p {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.tp-profile__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* 指标卡 */
.tp-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 16px;
}
.tp-metric {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  box-shadow: var(--shadow-soft);
  transition: box-shadow 0.25s, transform 0.25s;
}
.tp-metric:hover {
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}
.tp-metric__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  color: var(--blue);
  border-radius: 12px;
  background: var(--blue-soft);
  flex-shrink: 0;
}
.tp-metric__icon--green {
  color: var(--green);
  background: #e6f9f3;
}
.tp-metric__icon--cyan {
  color: var(--cyan);
  background: #e5f8fc;
}
.tp-metric__icon--amber {
  color: #f59e0b;
  background: #fef3e2;
}
.tp-metric__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.tp-metric__label {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.2px;
}
.tp-metric__value {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.1;
  letter-spacing: -0.2px;
}

/* 翻页 */
.tp-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
  color: var(--muted);
  font-size: 13px;
}
</style>
