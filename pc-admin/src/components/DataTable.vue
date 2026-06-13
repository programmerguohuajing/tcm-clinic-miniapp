<script setup>
defineProps({
  columns: {
    type: Array,
    required: true
  },
  rows: {
    type: Array,
    default: () => []
  },
  emptyText: {
    type: String,
    default: "暂无数据"
  }
});
</script>

<template>
  <div v-if="!rows.length" class="empty">{{ emptyText }}</div>
  <div v-else class="table-card element-table-card">
    <el-table :data="rows" stripe>
      <el-table-column
        v-for="column in columns"
        :key="column.key"
        :label="column.label"
        :prop="column.key"
        min-width="130"
      >
        <template #default="{ row }">
          <slot :name="column.key" :row="row">
            {{ row[column.key] ?? "-" }}
          </slot>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
