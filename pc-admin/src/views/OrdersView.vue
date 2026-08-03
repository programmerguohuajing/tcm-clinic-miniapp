<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import DataTable from "../components/DataTable.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { bootstrapState, loadBootstrap } from "../composables/useBootstrap";
import { adminApi } from "../services/adminApi";
import { dateText, money, timeText } from "../utils/format";
import { ElMessageBox, ElMessage } from "element-plus";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const loading = ref(false);
const updatingKey = ref("");
const filters = reactive({ keyword: "", status: "", practitionerId: "" });
const practitionerOptions = computed(() => {
  const list = props.storeId
    ? bootstrapState.practitioners.filter((p) => p.store_id == props.storeId)
    : bootstrapState.practitioners;
  return list.map((item) => ({ label: item.name, value: Number(item.id) }));
});
const orderStatusOptions = [
  { label: "待确认", value: "pending" },
  { label: "已确认", value: "confirmed" },
  { label: "已完成", value: "completed" },
  { label: "已取消", value: "cancelled" },
  { label: "已退款", value: "refunded" }
];

const columns = [
  { key: "order_no", label: "订单号" },
  { key: "user", label: "用户" },
  { key: "service_name", label: "项目" },
  { key: "store_name", label: "门店" },
  { key: "practitioner_name", label: "技师" },
  { key: "time", label: "时间" },
  { key: "amount", label: "金额" },
  { key: "status", label: "状态" },
  { key: "actions", label: "操作" }
];

async function load() {
  loading.value = true;
  try {
    await loadBootstrap();
    rows.value = await adminApi.orders({ storeId: props.storeId, ...filters });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.keyword = "";
  filters.status = "";
  filters.practitionerId = "";
  load();
}

const confirmLabels = {
  confirmed: "确认",
  completed: "核销",
  cancelled: "取消"
};

async function updateStatus(row, status) {
  const label = confirmLabels[status] || status;
  try {
    await ElMessageBox.confirm(`确认${label}订单 ${row.order_no}？`, "订单操作", {
      confirmButtonText: label,
      cancelButtonText: "取消",
      type: status === "cancelled" ? "warning" : "info"
    });
  } catch {
    return;
  }
  updatingKey.value = `${row.id}-${status}`;
  try {
    await adminApi.updateOrderStatus(row.id, status);
    props.showToast?.("订单状态已更新");
    await load();
  } catch (error) {
    props.showToast?.(error.message || "订单状态更新失败");
  } finally {
    updatingKey.value = "";
  }
}

onMounted(load);
watch(() => props.storeId, load);

const phoneBookingVisible = ref(false);
const phoneBookingForm = reactive({
  customerPhone: "",
  customerName: "",
  serviceId: "",
  practitionerId: "",
  scheduleId: "",
  note: ""
});
const phoneBookingLoading = ref(false);
const phoneBookingError = ref("");

function openPhoneBooking() {
  loadBootstrap();
  phoneBookingForm.customerPhone = "";
  phoneBookingForm.customerName = "";
  phoneBookingForm.serviceId = "";
  phoneBookingForm.practitionerId = "";
  phoneBookingForm.scheduleId = "";
  phoneBookingForm.note = "";
  phoneBookingForm._scheduleOptions = [];
  phoneBookingError.value = "";
  phoneBookingVisible.value = true;
}

function closePhoneBooking() {
  phoneBookingVisible.value = false;
}

async function loadScheduleOptions(practitionerId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const slots = await adminApi.schedules({
      practitionerId,
      date: today,
      storeId: props.storeId || ""
    });
    return (slots || []).filter((s) => s.available && s.status === "open");
  } catch {
    return [];
  }
}

async function onPractitionerChange() {
  phoneBookingForm.scheduleId = "";
  if (!phoneBookingForm.practitionerId) return;
  phoneBookingLoading.value = true;
  try {
    const slots = await loadScheduleOptions(Number(phoneBookingForm.practitionerId));
    phoneBookingForm._scheduleOptions = slots;
  } finally {
    phoneBookingLoading.value = false;
  }
}

async function submitPhoneBooking() {
  if (!phoneBookingForm.customerPhone || phoneBookingForm.customerPhone.length !== 11) {
    phoneBookingError.value = "请输入有效的11位手机号";
    return;
  }
  if (!phoneBookingForm.serviceId) {
    phoneBookingError.value = "请选择服务项目";
    return;
  }
  if (!phoneBookingForm.practitionerId) {
    phoneBookingError.value = "请选择技师";
    return;
  }
  if (!phoneBookingForm.scheduleId) {
    phoneBookingError.value = "请选择排班时段";
    return;
  }
  phoneBookingError.value = "";
  phoneBookingLoading.value = true;
  try {
    await adminApi.createOrder({
      customerPhone: phoneBookingForm.customerPhone,
      customerName: phoneBookingForm.customerName || undefined,
      serviceId: Number(phoneBookingForm.serviceId),
      practitionerId: Number(phoneBookingForm.practitionerId),
      scheduleId: Number(phoneBookingForm.scheduleId),
      storeId: props.storeId ? Number(props.storeId) : undefined,
      note: phoneBookingForm.note || undefined
    });
    ElMessage.success("预约创建成功");
    closePhoneBooking();
    await load();
  } catch (error) {
    phoneBookingError.value = error.message || "创建预约失败";
  } finally {
    phoneBookingLoading.value = false;
  }
}

const scheduleOptions = computed(() => {
  const list = phoneBookingForm._scheduleOptions || [];
  return list.map((s) => ({ label: `${s.work_date} ${s.start_time}-${s.end_time}`, value: Number(s.id) }));
});
</script>

<template>
  <PageSection title="预约订单">
    <template #actions>
      <div class="toolbar">
        <el-input v-model="filters.keyword" clearable placeholder="订单号 / 用户" style="width: 180px" @keyup.enter="load" />
        <el-select v-model="filters.status" clearable placeholder="订单状态" style="width: 140px">
          <el-option v-for="item in orderStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.practitionerId" clearable filterable placeholder="技师" style="width: 150px">
          <el-option v-for="item in practitionerOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <button class="primary" @click="load">查询</button>
        <button class="ghost" @click="resetFilters">重置</button>
        <button class="primary" @click="openPhoneBooking">新建订单</button>
      </div>
    </template>
    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #user="{ row }">{{ row.user_name }}<br /><small>{{ row.user_phone || "" }}</small></template>
      <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
      <template #amount="{ row }">{{ money(row.amount) }}</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
      <template #actions="{ row }">
        <div class="actions">
          <template v-if="row.status === 'pending'">
            <button class="ghost mini" :disabled="!!updatingKey" @click="updateStatus(row, 'confirmed')">
              {{ updatingKey === `${row.id}-confirmed` ? "确认中" : "确认" }}
            </button>
          </template>
          <template v-if="row.status === 'confirmed'">
            <button class="primary mini" :disabled="!!updatingKey" @click="updateStatus(row, 'completed')">
              {{ updatingKey === `${row.id}-completed` ? "核销中" : "核销" }}
            </button>
          </template>
          <template v-if="row.status === 'pending' || row.status === 'confirmed'">
            <button class="danger mini" :disabled="!!updatingKey" @click="updateStatus(row, 'cancelled')">
              {{ updatingKey === `${row.id}-cancelled` ? "取消中" : "取消" }}
            </button>
          </template>
        </div>
      </template>
    </DataTable>
  </PageSection>

  <el-dialog v-model="phoneBookingVisible" title="电话预约" width="520px" class="tcm-dialog" append-to-body align-center @close="closePhoneBooking">
    <el-form label-position="top" class="form-grid">
      <el-form-item label="客户手机号 *">
        <el-input v-model="phoneBookingForm.customerPhone" maxlength="11" placeholder="请输入手机号" />
      </el-form-item>
      <el-form-item label="客户姓名">
        <el-input v-model="phoneBookingForm.customerName" placeholder="选填，未填写则自动生成" />
      </el-form-item>
      <el-form-item label="服务项目 *">
        <el-select v-model="phoneBookingForm.serviceId" filterable clearable placeholder="请选择服务项目" style="width: 100%">
          <el-option v-for="item in bootstrapState.services" :key="item.id" :label="item.name" :value="Number(item.id)" />
        </el-select>
      </el-form-item>
      <el-form-item label="技师 *">
        <el-select v-model="phoneBookingForm.practitionerId" filterable clearable placeholder="请选择技师" style="width: 100%" @change="onPractitionerChange">
          <el-option v-for="item in practitionerOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="排班时段 *">
        <el-select v-model="phoneBookingForm.scheduleId" filterable clearable placeholder="请先选择技师" style="width: 100%" :loading="phoneBookingLoading" :disabled="!phoneBookingForm.practitionerId">
          <el-option v-for="item in scheduleOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="phoneBookingForm.note" type="textarea" :rows="3" placeholder="选填，如客户特殊需求" />
      </el-form-item>
    </el-form>
    <div v-if="phoneBookingError" class="phone-error">{{ phoneBookingError }}</div>
    <template #footer>
      <el-button @click="closePhoneBooking">取消</el-button>
      <el-button type="primary" :loading="phoneBookingLoading" @click="submitPhoneBooking">确认预约</el-button>
    </template>
  </el-dialog>
</template>
