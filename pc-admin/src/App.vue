<script setup>
import { ref } from "vue";
import { RouterView, useRoute } from "vue-router";
import AdminLayout from "./layouts/AdminLayout.vue";
import ToastMessage from "./components/ToastMessage.vue";
import { useToast } from "./composables/useToast";

const route = useRoute();
const storeId = ref("");
const refreshKey = ref(0);
const { toast, showToast } = useToast();

function refresh() {
  refreshKey.value += 1;
}
</script>

<template>
  <AdminLayout
    v-if="!route.meta.public"
    @store-change="storeId = $event"
    @refresh="refresh"
  >
    <RouterView :key="$route.fullPath + refreshKey" :store-id="storeId" :show-toast="showToast" />
  </AdminLayout>
  <RouterView v-else />
  <ToastMessage :toast="toast" />
</template>
