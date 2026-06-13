<script setup>
import { onMounted, ref, watch } from "vue";
import DataTable from "../components/DataTable.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { adminApi } from "../services/adminApi";
import { dateText, money, timeText } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const updatingKey = ref("");

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
  rows.value = await adminApi.orders({ storeId: props.storeId });
}

async function updateStatus(row, status) {
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
</script>

<template>
  <PageSection title="预约订单">
    <DataTable :columns="columns" :rows="rows">
      <template #user="{ row }">{{ row.user_name }}<br /><small>{{ row.user_phone || "" }}</small></template>
      <template #time="{ row }">{{ dateText(row.appointment_date) }} {{ timeText(row.start_time) }}</template>
      <template #amount="{ row }">{{ money(row.amount) }}</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
      <template #actions="{ row }">
        <div class="actions">
          <button class="ghost mini" :disabled="!!updatingKey" @click="updateStatus(row, 'confirmed')">
            {{ updatingKey === `${row.id}-confirmed` ? "确认中" : "确认" }}
          </button>
          <button class="primary mini" :disabled="!!updatingKey" @click="updateStatus(row, 'completed')">
            {{ updatingKey === `${row.id}-completed` ? "核销中" : "核销" }}
          </button>
          <button class="danger mini" :disabled="!!updatingKey" @click="updateStatus(row, 'cancelled')">
            {{ updatingKey === `${row.id}-cancelled` ? "取消中" : "取消" }}
          </button>
        </div>
      </template>
    </DataTable>
  </PageSection>
</template>
