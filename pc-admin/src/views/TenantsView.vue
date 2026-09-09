<template>
  <PageSection title="商户管理" description="多租户商户入驻与品牌信息维护；新建商户自动初始化术语字典并挂基础套餐">
    <div class="toolbar">
      <span v-if="rows.length" class="muted">共 {{ rows.length }} 家商户</span>
      <span class="spacer" />
      <button v-if="isOwner" class="primary" @click="addTenant">新建商户</button>
      <button class="ghost" @click="load">刷新</button>
    </div>

    <DataTable
      :columns="[
        { key: 'name', label: '商户名称' },
        { key: 'slug', label: 'Slug' },
        { key: 'industry_template_key', label: '业态模板' },
        { key: 'current_plan', label: '当前套餐' },
        { key: 'brand_tagline', label: '品牌标语' },
        { key: 'status', label: '状态' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
      :loading="loading"
    >
      <template #industry_template_key="{ row }">
        <span class="pill">{{ templateLabel(row.industry_template_key) }}</span>
      </template>
      <template #current_plan="{ row }">
        {{ planLabelMap[row.current_plan] || row.current_plan || "未挂套餐" }}
      </template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
      <template #actions="{ row }">
        <div class="actions">
          <button v-if="canEdit(row)" class="ghost mini" @click="editTenant(row)">编辑品牌</button>
        </div>
      </template>
    </DataTable>

    <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
  </PageSection>
</template>

<script setup>
import { onMounted, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { adminApi } from "../services/adminApi";
import { getCurrentUser } from "../services/auth";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const loading = ref(false);
const templateOptions = ref([]);

// owner 可新建商户；商户管理员可编辑本商户品牌（后端双重校验）
const user = getCurrentUser();
const currentRole = user?.admin_role || "";
const isOwner = ["owner", ""].includes(currentRole);
const canEdit = (row) => isOwner || (currentRole === "tenant_admin" && user?.tenant_id === row.id);

const planLabelMap = { basic: "基础版", pro: "专业版", flagship: "旗舰版" };
const templateLabelMap = { tcm_clinic: "中医馆", gym: "健身房" };
const templateLabel = (key) => templateLabelMap[key] || key;

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

async function load() {
  loading.value = true;
  try {
    const res = await adminApi.adminTenants();
    rows.value = res?.data || [];
  } finally {
    loading.value = false;
  }
}

function themePayload(model, fallback = {}) {
  return model.themePrimary ? { ...fallback, primary: model.themePrimary } : fallback;
}

function addTenant() {
  openEditor({
    title: "新建商户（入驻）",
    model: { name: "", slug: "", industryTemplateKey: "tcm_clinic", brandTagline: "", themePrimary: "" },
    fields: [
      { name: "name", label: "商户名称", required: true },
      { name: "slug", label: "Slug（URL 标识，小写字母/数字/连字符）", required: true },
      { name: "industryTemplateKey", label: "业态模板", type: "select", options: templateOptions.value },
      { name: "brandTagline", label: "品牌标语" },
      { name: "themePrimary", label: "主题色（如 #7c5c3e）" }
    ],
    submit: async (model) => {
      await adminApi.createTenant({
        name: model.name,
        slug: model.slug,
        industryTemplateKey: model.industryTemplateKey,
        brandTagline: model.brandTagline || undefined,
        themeTokens: themePayload(model)
      });
    }
  });
}

function editTenant(row) {
  openEditor({
    title: `编辑 ${row.name} 品牌信息`,
    model: { name: row.name, brandTagline: row.brand_tagline || "", themePrimary: row.theme_tokens?.primary || "" },
    fields: [
      { name: "name", label: "商户名称", required: true },
      { name: "brandTagline", label: "品牌标语" },
      { name: "themePrimary", label: "主题色（如 #7c5c3e）" }
    ],
    submit: async (model) => {
      await adminApi.updateTenant(row.id, {
        name: model.name,
        brand_tagline: model.brandTagline || undefined,
        theme_tokens: themePayload(model, row.theme_tokens || {})
      });
    }
  });
}

onMounted(async () => {
  load();
  try {
    const res = await adminApi.templates();
    const list = res?.data || [];
    templateOptions.value = list.map((t) => ({ label: templateLabelMap[t.key] || t.name || t.key, value: t.key }));
  } catch {
    templateOptions.value = [
      { label: "中医馆", value: "tcm_clinic" },
      { label: "健身房", value: "gym" }
    ];
  }
});
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.toolbar .spacer { flex: 1; }
.muted { color: var(--text-secondary, #888); font-size: 13px; }
.pill { background: var(--bg-secondary, #f3f4f6); border-radius: 999px; padding: 2px 10px; font-size: 12px; }
.actions { display: flex; gap: 6px; }
</style>
