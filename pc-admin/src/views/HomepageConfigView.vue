<script setup>
import { computed, onMounted, ref, watch } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { bootstrapState, loadBootstrap } from "../composables/useBootstrap";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { jsonText } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const storeOptions = computed(() => [{ label: "通用/不绑定", value: "" }, ...bootstrapState.stores.map((s) => ({ label: s.name, value: Number(s.id) }))]);

async function load() {
  await loadBootstrap();
  rows.value = await adminApi.homepageConfigs({ storeId: props.storeId });
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row = {}) {
  openEditor({
    title: row.id ? "编辑首页配置" : "新增首页配置",
    model: {
      id: row.id,
      storeId: row.store_id ? Number(row.store_id) : (props.storeId ? Number(props.storeId) : ""),
      sectionKey: row.section_key || "hero",
      title: row.title || "",
      payloadText: jsonText(row.payload || { headline: "首页标题", button: "立即预约" }),
      sortOrder: row.sort_order || 0,
      isActive: row.is_active !== false
    },
    fields: [
      { name: "storeId", label: "门店", type: "select", options: storeOptions.value },
      { name: "sectionKey", label: "模块标识" },
      { name: "title", label: "标题" },
      { name: "sortOrder", label: "排序", type: "number" },
      { name: "payloadText", label: "JSON 配置", type: "textarea", wide: true },
      { name: "isActive", label: "是否启用", type: "select", options: statusOptions.bool }
    ],
    submit: (model) => adminApi.saveHomepageConfig({
      ...model,
      payload: JSON.parse(model.payloadText || "{}")
    })
  });
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <PageSection title="小程序首页配置" action-text="新增配置" @action="edit()">
    <DataTable
      :columns="[
        { key: 'store_name', label: '门店' },
        { key: 'section_key', label: '模块' },
        { key: 'title', label: '标题' },
        { key: 'payload', label: '配置内容' },
        { key: 'sort_order', label: '排序' },
        { key: 'is_active', label: '状态' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
    >
      <template #store_name="{ row }">{{ row.store_name || "通用" }}</template>
      <template #payload="{ row }"><code>{{ JSON.stringify(row.payload) }}</code></template>
      <template #is_active="{ row }"><StatusPill :value="row.is_active" /></template>
      <template #actions="{ row }"><button class="ghost mini" @click="edit(row)">编辑</button></template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
