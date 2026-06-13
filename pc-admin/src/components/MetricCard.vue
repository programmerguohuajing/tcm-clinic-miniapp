<script setup>
defineProps({
  label: String,
  value: [String, Number]
});
</script>

<template>
  <div class="card metric">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
  </div>
</template>
