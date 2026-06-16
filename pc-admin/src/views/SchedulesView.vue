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
import { dateText, timeText } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const filters = reactive({ practitionerId: "", date: "" });

const practitionerOptions = computed(() => [{ label: "请选择技师", value: "" }, ...bootstrapState.practitioners.map((p) => ({ label: p.name, value: Number(p.id) }))]);

const columns = [
  { key: "work_date", label: "日期" },
  { key: "time", label: "时间" },
  { key: "store_name", label: "门店" },
  { key: "practitioner_name", label: "技师" },
  { key: "capacity", label: "容量" },
  { key: "status", label: "状态" }
];

async function load() {
  await loadBootstrap();
  rows.value = await adminApi.schedules({ storeId: props.storeId, ...filters });
}

function resetFilters() {
  filters.practitionerId = "";
  filters.date = "";
  load();
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function today(offset = 0) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

function openSingle() {
  openEditor({
    title: "新增排班",
    model: {
      storeId: props.storeId ? Number(props.storeId) : "",
      practitionerId: "",
      workDate: today(),
      startTime: "09:30",
      endTime: "10:30",
      capacity: 1,
      status: "open"
    },
    fields: [
      { name: "practitionerId", label: "技师", type: "select", options: practitionerOptions.value },
      { name: "workDate", label: "日期", type: "date" },
      { name: "startTime", label: "开始时间", type: "time" },
      { name: "endTime", label: "结束时间", type: "time" },
      { name: "capacity", label: "容量", type: "number" },
      { name: "status", label: "状态", type: "select", options: statusOptions.schedule }
    ],
    submit: adminApi.saveSchedule
  });
}

function openBulk() {
  openEditor({
    title: "批量生成排班",
    model: {
      storeId: props.storeId ? Number(props.storeId) : "",
      practitionerId: "",
      startDate: today(),
      endDate: today(7),
      weekdays: "1,2,3,4,5",
      slotsText: "09:30-10:30,2\n14:00-15:00,2"
    },
    fields: [
      { name: "practitionerId", label: "技师", type: "select", options: practitionerOptions.value },
      { name: "startDate", label: "开始日期", type: "date" },
      { name: "endDate", label: "结束日期", type: "date" },
      { name: "weekdays", label: "星期，0-6 逗号分隔" },
      { name: "slotsText", label: "时间段，每行 09:30-10:30,2", type: "textarea", wide: true }
    ],
    submit: (model) => adminApi.bulkSchedules({
      ...model,
      weekdays: String(model.weekdays).split(",").map(Number),
      slots: String(model.slotsText).split("\n").filter(Boolean).map((line) => {
        const [range, capacity = 1] = line.split(",");
        const [startTime, endTime] = range.split("-");
        return { startTime: startTime.trim(), endTime: endTime.trim(), capacity: Number(capacity) };
      })
    })
  });
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <PageSection title="排班日历">
    <template #actions>
      <div class="toolbar">
        <el-select v-model="filters.practitionerId" clearable filterable placeholder="技师" style="width: 150px">
          <el-option v-for="item in practitionerOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-date-picker v-model="filters.date" value-format="YYYY-MM-DD" placeholder="日期" style="width: 150px" />
        <button class="primary" @click="load">查询</button>
        <button class="ghost" @click="resetFilters">重置</button>
        <button class="primary" @click="openSingle">新增排班</button>
        <button class="ghost" @click="openBulk">批量排班</button>
      </div>
    </template>
    <DataTable :columns="columns" :rows="rows">
      <template #work_date="{ row }">{{ dateText(row.work_date) }}</template>
      <template #time="{ row }">{{ timeText(row.start_time) }}-{{ timeText(row.end_time) }}</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
