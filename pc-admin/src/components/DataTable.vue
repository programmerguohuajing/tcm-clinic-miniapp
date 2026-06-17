<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  columns: {
    type: Array,
    required: true
  },
  rows: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: "暂无数据"
  },
  pageSize: {
    type: Number,
    default: 20
  }
});

const currentPage = ref(1);

watch(() => props.rows, () => {
  currentPage.value = 1;
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize;
  return props.rows.slice(start, start + props.pageSize);
});

const total = computed(() => props.rows.length);

function onPageChange(page) {
  currentPage.value = page;
}
</script>

<template>
  <div v-if="loading" class="empty">加载中...</div>
  <div v-else-if="!rows.length" class="empty">{{ emptyText }}</div>
  <div v-else class="table-card element-table-card">
    <el-table :data="pagedRows" stripe size="small" table-layout="auto" scrollbar-always-on>
      <el-table-column
        v-for="column in columns"
        :key="column.key"
        :label="column.label"
        :prop="column.key"
        min-width="118"
      >
        <template #default="{ row }">
          <slot :name="column.key" :row="row">
            {{ row[column.key] ?? "-" }}
          </slot>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="total > pageSize" class="pagination-bar">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        small
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 4px;
}
</style>
