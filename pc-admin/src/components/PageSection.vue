<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  actionText: String
});

defineEmits(["action"]);
</script>

<template>
  <section>
    <div class="section-head">
      <h2>{{ title }}</h2>
      <el-button v-if="actionText" type="primary" @click="$emit('action')">{{ actionText }}</el-button>
      <slot name="actions"></slot>
    </div>
    <slot></slot>
  </section>
</template>
