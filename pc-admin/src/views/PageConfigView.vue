<script setup>
import { computed, onMounted, ref, watch } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { loadBootstrap } from "../composables/useBootstrap";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { jsonText } from "../utils/format";

const props = defineProps({ showToast: Function });
const tenants = ref([]);
const tenantId = ref("");
const pageKey = ref("home");
const pageKeys = ["home", "booking", "profile"];
const rows = ref([]);
const loading = ref(false);

// 品牌设置
const brand = ref({ name: "", brand_tagline: "", primary: "#E76F3C" });
const savingBrand = ref(false);

async function loadTenants() {
  tenants.value = await adminApi.tenants();
  if (!tenantId.value && tenants.value.length) {
    tenantId.value = String(tenants.value[0].id);
  }
}

async function load() {
  if (!tenantId.value) return;
  loading.value = true;
  try {
    await loadBootstrap();
    const list = await adminApi.pageConfigs({ tenantId: tenantId.value, pageKey: pageKey.value });
    rows.value = list || [];
    const t = tenants.value.find((x) => String(x.id) === String(tenantId.value));
    if (t) {
      brand.value = {
        name: t.name || "",
        brand_tagline: t.brand_tagline || "",
        primary: (t.theme_tokens && t.theme_tokens.primary) || "#E76F3C"
      };
    }
  } finally {
    loading.value = false;
  }
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row = {}) {
  openEditor({
    title: row.id ? "编辑区块配置" : "新增区块配置",
    model: {
      id: row.id,
      tenantId: tenantId.value,
      pageKey: row.page_key || pageKey.value,
      sectionKey: row.section_key || "",
      title: row.title || "",
      sortOrder: row.sort_order || 0,
      payloadText: jsonText(row.payload || {}),
      isActive: row.is_active !== false
    },
    fields: [
      { name: "sectionKey", label: "区块标识", placeholder: "如 service_list" },
      { name: "title", label: "标题" },
      { name: "sortOrder", label: "排序", type: "number" },
      { name: "payloadText", label: "JSON 配置", type: "textarea", wide: true },
      { name: "isActive", label: "是否启用", type: "select", options: statusOptions.bool }
    ],
    submit: (model) => {
      const payload = JSON.parse(model.payloadText || "{}");
      if (model.id) {
        return adminApi.updatePageConfig(model.id, {
          title: model.title,
          payload,
          sortOrder: model.sortOrder,
          isActive: model.isActive
        });
      }
      return adminApi.savePageConfig({
        tenantId: Number(model.tenantId),
        pageKey: model.pageKey,
        sectionKey: model.sectionKey,
        title: model.title,
        payload,
        sortOrder: model.sortOrder,
        isActive: model.isActive
      });
    }
  });
}

async function remove(row) {
  if (!confirm(`确认删除区块「${row.title || row.section_key}」？`)) return;
  await adminApi.deletePageConfig(row.id);
  await load();
  props.showToast && props.showToast("已删除");
}

async function saveBrand() {
  if (!tenantId.value) return;
  savingBrand.value = true;
  try {
    const theme_tokens = { primary: brand.value.primary };
    await adminApi.updateTenant(Number(tenantId.value), {
      name: brand.value.name,
      brand_tagline: brand.value.brand_tagline,
      theme_tokens
    });
    props.showToast && props.showToast("品牌设置已保存");
    await loadTenants();
  } finally {
    savingBrand.value = false;
  }
}

const tenantLabel = computed(() => {
  const t = tenants.value.find((x) => String(x.id) === String(tenantId.value));
  return t ? `${t.name}（${t.slug}）` : "请选择租户";
});

onMounted(async () => {
  await loadTenants();
  await load();
});
watch([tenantId, pageKey], load);
</script>

<template>
  <PageSection title="品牌设置" subtitle="配置租户品牌名、主色与标语，C 端即时生效">
    <div class="brand-grid">
      <label>品牌名称
        <el-input v-model="brand.name" placeholder="如 青囊中医馆" />
      </label>
      <label>品牌标语
        <el-input v-model="brand.brand_tagline" placeholder="如 把脉问诊 · 调理身心" />
      </label>
      <label>主色
        <div class="color-row">
          <el-color-picker v-model="brand.primary" />
          <span class="color-value">{{ brand.primary }}</span>
        </div>
      </label>
      <div class="brand-actions">
        <button class="primary" :disabled="savingBrand" @click="saveBrand">
          {{ savingBrand ? "保存中…" : "保存品牌设置" }}
        </button>
      </div>
    </div>
  </PageSection>

  <PageSection :title="`页面区块配置 · ${tenantLabel}`" action-text="新增区块" @action="edit()">
    <div class="pagekey-tabs">
      <button
        v-for="pk in pageKeys"
        :key="pk"
        class="pagekey"
        :class="{ active: pageKey === pk }"
        @click="pageKey = pk"
      >{{ pk }}</button>
    </div>
    <DataTable
      :columns="[
        { key: 'section_key', label: '区块标识' },
        { key: 'title', label: '标题' },
        { key: 'payload', label: '配置内容' },
        { key: 'sort_order', label: '排序' },
        { key: 'is_active', label: '状态' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
      :loading="loading"
    >
      <template #payload="{ row }"><code>{{ JSON.stringify(row.payload) }}</code></template>
      <template #is_active="{ row }"><StatusPill :value="row.is_active" /></template>
      <template #actions="{ row }">
        <button class="ghost mini" @click="edit(row)">编辑</button>
        <button class="ghost mini danger" @click="remove(row)">删除</button>
      </template>
    </DataTable>
  </PageSection>

  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>

<style scoped>
.brand-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
  align-items: end;
}
.brand-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--muted, #73777d);
}
.color-row { display: flex; align-items: center; gap: 10px; }
.color-value { font-family: monospace; color: var(--text, #2d3035); }
.brand-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
.pagekey-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.pagekey {
  padding: 6px 14px;
  border: 1px solid var(--border, #dee1e4);
  border-radius: 8px;
  background: var(--surface, #fff);
  color: var(--muted, #73777d);
  cursor: pointer;
}
.pagekey.active { border-color: var(--primary, #e76f3c); color: var(--primary, #e76f3c); }
.ghost.mini.danger { color: #c0392b; }
</style>
