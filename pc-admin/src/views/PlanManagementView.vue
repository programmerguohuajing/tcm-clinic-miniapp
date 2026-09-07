<script setup>
import { onMounted, ref } from "vue";
import PageSection from "../components/PageSection.vue";
import { adminApi } from "../services/adminApi";

const tenantId = ref(null);
const plans = ref([]);
const current = ref(null);
const loading = ref(false);
const saving = ref(false);
const selectedPlan = ref("");
const savedAt = ref("");

async function ensureTenant() {
  if (tenantId.value) return;
  const tenants = await adminApi.tenants();
  tenantId.value = (tenants && tenants[0] && tenants[0].id) || null;
}

async function load() {
  await ensureTenant();
  loading.value = true;
  try {
    plans.value = await adminApi.plans();
    if (tenantId.value) {
      current.value = await adminApi.tenantPlan(tenantId.value);
      selectedPlan.value = (current.value && current.value.key) || "basic";
    }
  } finally {
    loading.value = false;
  }
}

async function savePlan() {
  if (!tenantId.value) return;
  saving.value = true;
  try {
    await adminApi.setTenantPlan(tenantId.value, selectedPlan.value);
    savedAt.value = new Date().toLocaleTimeString();
    await load();
  } catch (e) {
    alert(e.message || "套餐设置失败");
  } finally {
    saving.value = false;
  }
}

function tagList(arr) {
  return Array.isArray(arr) ? arr : [];
}

onMounted(load);
</script>

<template>
  <PageSection title="套餐管理" :loading="loading">
    <template #actions>
      <div class="current-plan">
        当前套餐：
        <strong>{{ (current && current.name) || "基础版" }}</strong>
        <span v-if="current && current.default" class="tag">默认</span>
      </div>
    </template>

    <div class="plan-grid">
      <div
        v-for="p in plans"
        :key="p.key"
        class="plan-card"
        :class="{ active: selectedPlan === p.key }"
        @click="selectedPlan = p.key"
      >
        <h3>{{ p.name }}</h3>
        <p class="desc">{{ p.description }}</p>
        <div class="block">
          <span class="block-title">菜单</span>
          <span v-for="m in tagList(p.menus)" :key="m" class="chip">{{ m }}</span>
        </div>
        <div class="block">
          <span class="block-title">能力</span>
          <span v-for="c in tagList(p.capabilities)" :key="c" class="chip chip-cap">{{ c }}</span>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span v-if="savedAt" class="muted">已保存 {{ savedAt }}</span>
      <button class="primary" :disabled="saving" @click="savePlan">
        {{ saving ? "保存中…" : "应用套餐到此租户" }}
      </button>
    </div>
  </PageSection>
</template>

<style scoped>
.current-plan { font-size: 13px; color: #6b4f2a; }
.current-plan strong { color: #2b2118; font-size: 15px; margin: 0 4px; }
.tag { font-size: 12px; padding: 1px 6px; border: 1px solid #e3d3bf; border-radius: 4px; color: #6b4f2a; }
.plan-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-top: 8px; }
.plan-card { border: 1px solid #e7d8c2; border-radius: 10px; padding: 16px; cursor: pointer; background: #fffdf9; transition: border-color .15s, box-shadow .15s; }
.plan-card:hover { box-shadow: 0 6px 20px rgba(120,80,30,.08); }
.plan-card.active { border-color: #c8743a; box-shadow: 0 0 0 2px rgba(200,116,58,.18); }
.plan-card h3 { margin: 0 0 4px; color: #2b2118; }
.desc { margin: 0 0 12px; font-size: 13px; color: #8a6d4b; min-height: 34px; }
.block { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.block-title { font-size: 12px; color: #99836a; width: 100%; }
.chip { font-size: 12px; padding: 2px 8px; border-radius: 12px; background: #f3e9da; color: #6b4f2a; }
.chip-cap { background: #efe6f4; color: #5b3d7a; }
.footer-bar { display: flex; align-items: center; justify-content: flex-end; gap: 14px; margin-top: 18px; }
.muted { color: #99836a; font-size: 13px; }
</style>
