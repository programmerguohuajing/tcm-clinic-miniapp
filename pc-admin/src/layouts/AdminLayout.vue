<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { navItems } from "../constants/nav";
import { bootstrapState, loadBootstrap } from "../composables/useBootstrap";

const route = useRoute();
const router = useRouter();
const storeId = ref("");
const emit = defineEmits(["store-change", "refresh"]);

const pageTitle = computed(() => route.meta.title || "管理端");

onMounted(loadBootstrap);

function onStoreChange() {
  emit("store-change", storeId.value);
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="seal">青</div>
        <div>
          <strong>青囊掌柜台</strong>
          <span>TCM OPERATIONS</span>
        </div>
      </div>

      <nav>
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: route.name === item.key }"
          @click="router.push(item.path)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="operator-card">
        <span>当前账号</span>
        <strong>林青禾</strong>
        <small>权限由小程序用户绑定</small>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <p class="eyebrow">Clinic Command Center</p>
          <h1>{{ pageTitle }}</h1>
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
          <button class="ghost" @click="$emit('refresh')">刷新数据</button>
        </div>
      </header>

      <section class="view">
        <slot :store-id="storeId"></slot>
      </section>
    </main>
  </div>
</template>
