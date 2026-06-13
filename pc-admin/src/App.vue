<script setup>
import { ref } from "vue";
import { RouterView } from "vue-router";
import AdminLayout from "./layouts/AdminLayout.vue";
import ToastMessage from "./components/ToastMessage.vue";
import { useToast } from "./composables/useToast";

const storeId = ref("");
const refreshKey = ref(0);
const { toast, showToast } = useToast();

function refresh() {
  refreshKey.value += 1;
}
</script>

<template>
  <AdminLayout
    @store-change="storeId = $event"
    @refresh="refresh"
  >
    <RouterView :key="$route.fullPath + refreshKey" :store-id="storeId" :show-toast="showToast" />
  </AdminLayout>
  <ToastMessage :toast="toast" />
</template>
