<script setup>
import { isOffStatus, statusLabel } from "../utils/format";

defineProps({
  value: {
    type: [String, Boolean],
    default: ""
  }
});
</script>

<template>
  <el-tag
    round
    effect="light"
    :type="isOffStatus(value) || value === false ? 'danger' : 'success'"
  >
    {{ typeof value === "boolean" ? (value ? "是" : "否") : statusLabel(value) }}
  </el-tag>
</template>
