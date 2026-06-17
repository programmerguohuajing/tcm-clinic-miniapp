<script setup>
import { computed } from "vue";

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  rows: {
    type: Array,
    default: () => []
  },
  labelKey: {
    type: String,
    required: true
  },
  valueKey: {
    type: String,
    required: true
  }
});

const maxValue = computed(() => Math.max(...props.rows.map((item) => Number(item[props.valueKey] || 0)), 1));

function width(row) {
  return `${Math.max((Number(row[props.valueKey] || 0) / maxValue.value) * 100, 5)}%`;
}
</script>

<template>
  <div class="card">
    <p class="eyebrow">{{ title }}</p>
    <div v-if="rows.length" class="bar-list">
      <div v-for="row in rows" :key="row.id || row[labelKey]" class="bar-row">
        <span>{{ row[labelKey] || "未命名" }}</span>
        <div class="bar"><i :style="{ width: width(row) }"></i></div>
        <strong>{{ row[valueKey] }}</strong>
      </div>
    </div>
    <div v-else class="muted-line">暂无排行数据</div>
  </div>
</template>
