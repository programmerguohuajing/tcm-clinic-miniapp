<script setup>
import { onMounted, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import PageSection from "../components/PageSection.vue";
import { adminApi } from "../services/adminApi";

const rows = ref([]);

onMounted(async () => {
  rows.value = await adminApi.auditLogs();
});
</script>

<template>
  <PageSection title="操作日志">
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
      <template #created_at="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
      <template #target="{ row }">{{ row.target_type || "-" }} #{{ row.target_id || "" }}</template>
      <template #detail="{ row }"><code>{{ JSON.stringify(row.detail) }}</code></template>
    </DataTable>
  </PageSection>
</template>
