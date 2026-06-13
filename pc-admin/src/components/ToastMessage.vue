<script setup>
import { watch } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps({
  toast: {
    type: Object,
    required: true
  }
});

watch(
  () => props.toast.visible,
  (visible) => {
    if (visible && props.toast.message) {
      ElMessage.success(props.toast.message);
    }
  }
);
</script>

<template></template>
