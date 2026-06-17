<script setup>
import { watch } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps({
  toast: {
    type: Object,
    required: true
  }
});

const typeMap = {
  success: "success",
  error: "error",
  warning: "warning",
  info: "info"
};

watch(
  () => props.toast.visible,
  (visible) => {
    if (visible && props.toast.message) {
      const type = typeMap[props.toast.type] || "success";
      ElMessage[type](props.toast.message);
    }
  }
);
</script>

<template></template>
