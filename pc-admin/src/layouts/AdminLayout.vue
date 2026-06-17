<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { navItems } from "../constants/nav";
import { bootstrapState, loadBootstrap } from "../composables/useBootstrap";
import { clearSession, getCurrentUser } from "../services/auth";

const route = useRoute();
const router = useRouter();
const storeId = ref("");
const emit = defineEmits(["store-change", "refresh"]);
const HOME_TAB_KEY = "dashboard";
const openedTabs = ref([navItems[0]]);
const currentUser = ref(getCurrentUser());
const sidebarOpen = ref(false);

const pageTitle = computed(() => route.meta.title || "管理端");
const displayUser = computed(() => {
  const user = currentUser.value || {};
  return {
    name: user.nickname || user.phone || "开发演示账号",
    meta: user.admin_role ? `${user.admin_role} · ${user.phone || "未绑定手机号"}` : "开发模式免登录"
  };
});
const avatarText = computed(() => displayUser.value.name.slice(0, 1).toUpperCase());
const navIconMap = {
  dashboard: "DB",
  stores: "ST",
  services: "SV",
  practitioners: "PR",
  schedules: "SC",
  technicianPortal: "TP",
  orders: "OR",
  commissions: "CM",
  homepage: "HP",
  content: "CT",
  users: "US",
  reviews: "RV",
  audit: "AU"
};

onMounted(() => {
  currentUser.value = getCurrentUser();
  loadBootstrap();
});

watch(
  () => route.name,
  (routeName) => {
    const currentTab = navItems.find((item) => item.key === routeName);
    if (!currentTab) return;
    if (!openedTabs.value.some((item) => item.key === currentTab.key)) {
      openedTabs.value = [...openedTabs.value, currentTab];
    }
    sidebarOpen.value = false;
  },
  { immediate: true }
);

function onStoreChange() {
  emit("store-change", storeId.value);
}

function logout() {
  clearSession();
  router.replace({ name: "login" });
}

function closeTab(tab) {
  if (tab.key === HOME_TAB_KEY || openedTabs.value.length <= 1) return;

  const closedIndex = openedTabs.value.findIndex((item) => item.key === tab.key);
  const nextTabs = openedTabs.value.filter((item) => item.key !== tab.key);
  openedTabs.value = nextTabs;

  if (route.name !== tab.key) return;

  const fallbackIndex = Math.max(closedIndex - 1, 0);
  const fallbackTab = nextTabs[fallbackIndex] || nextTabs[0] || navItems[0];
  router.push(fallbackTab.path);
}

function goNav(path) {
  router.push(path);
  sidebarOpen.value = false;
}
</script>

<template>
  <div class="shell" :class="{ 'sidebar-open': sidebarOpen }">
    <button
      v-if="sidebarOpen"
      class="sidebar-scrim"
      type="button"
      aria-label="收起菜单"
      @click="sidebarOpen = false"
    ></button>

    <aside class="sidebar">
      <div class="brand">
        <div class="seal">掌</div>
        <div>
          <strong>青囊中医馆管理系统</strong>
          <span>TCM ADMIN</span>
        </div>
      </div>

      <nav>
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: route.name === item.key }"
          @click="goNav(item.path)"
        >
          <span class="nav-icon">{{ navIconMap[item.key] || "•" }}</span>
          <span>{{ item.label }}</span>
          <span class="nav-caret">›</span>
        </button>
      </nav>

      <div class="operator-card">
        <span>当前账号</span>
        <strong>{{ displayUser.name }}</strong>
        <small>{{ displayUser.meta }}</small>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="menu-toggle"
            type="button"
            :aria-expanded="sidebarOpen"
            aria-label="展开菜单"
            @click="sidebarOpen = !sidebarOpen"
          >
            ☰
          </button>
          <div>
            <div class="breadcrumb">
              <span>首页</span>
              <span>/</span>
              <strong aria-current="page">{{ pageTitle }}</strong>
            </div>
          </div>
        </div>
        <div class="toolbar">
          <el-select
            v-model="storeId"
            class="store-filter"
            placeholder="全部门店"
            @change="onStoreChange"
          >
            <el-option label="全部门店" value="" />
            <el-option
              v-for="store in bootstrapState.stores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
          <button class="ghost" @click="$emit('refresh')">刷新</button>
          <div class="profile-chip">
            <span class="avatar">{{ avatarText }}</span>
            <span>{{ displayUser.name }}</span>
          </div>
          <button class="ghost" type="button" @click="logout">退出</button>
        </div>
      </header>

      <div class="tabbar">
        <button
          v-for="item in openedTabs"
          :key="`tab-${item.key}`"
          class="page-tab"
          :class="{ active: route.name === item.key }"
          type="button"
          @click="router.push(item.path)"
        >
          {{ item.label }}
          <span
            v-if="item.key !== HOME_TAB_KEY"
            class="tab-close"
            role="button"
            tabindex="0"
            :aria-label="`关闭 ${item.label}`"
            @click.stop="closeTab(item)"
            @keydown.enter.prevent.stop="closeTab(item)"
            @keydown.space.prevent.stop="closeTab(item)"
          >
            ×
          </span>
        </button>
      </div>

      <section class="view">
        <slot :store-id="storeId"></slot>
      </section>
    </main>
  </div>
</template>
