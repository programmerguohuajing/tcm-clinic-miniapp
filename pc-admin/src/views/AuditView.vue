<script setup>
import { onMounted, reactive, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import PageSection from "../components/PageSection.vue";
import { adminApi } from "../services/adminApi";

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

const rows = ref([]);
const filters = reactive({ keyword: "", action: "", targetType: "", dateRange: [] });

async function load() {
  rows.value = await adminApi.auditLogs({
    keyword: filters.keyword,
    action: filters.action,
    targetType: filters.targetType,
    startDate: filters.dateRange?.[0] || "",
    endDate: filters.dateRange?.[1] || ""
  });
}

function resetFilters() {
  filters.keyword = "";
  filters.action = "";
  filters.targetType = "";
  filters.dateRange = [];
  load();
}

onMounted(load);
</script>

<template>
  <PageSection title="操作日志">
    <template #actions>
      <div class="toolbar">
        <el-input v-model="filters.keyword" clearable placeholder="动作 / 对象 / 操作人" style="width: 190px" @keyup.enter="load" />
        <el-input v-model="filters.action" clearable placeholder="动作" style="width: 150px" @keyup.enter="load" />
        <el-input v-model="filters.targetType" clearable placeholder="对象类型" style="width: 140px" @keyup.enter="load" />
        <el-date-picker v-model="filters.dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 240px" />
        <button class="primary" @click="load">查询</button>
        <button class="ghost" @click="resetFilters">重置</button>
      </div>
    </template>
    <DataTable
      :columns="[
        { key: 'created_at', label: '时间' },
        { key: 'user_name', label: '操作人' },
        { key: 'action', label: '动作' },
        { key: 'target', label: '对象' },
        { key: 'detail', label: '详情' }
      ]"
      :rows="rows"
    >
      <template #created_at="{ row }">{{ formatDate(row.created_at) }}</template>
      <template #target="{ row }">{{ row.target_type || "-" }} #{{ row.target_id || "" }}</template>
      <template #detail="{ row }"><code>{{ JSON.stringify(row.detail) }}</code></template>
    </DataTable>
  </PageSection>
</template>
