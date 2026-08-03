<script setup>
import { onMounted, ref, watch } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { bootstrapState, loadBootstrap } from "../composables/useBootstrap";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { money } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);

const storeOptions = computed(() => [{ label: "通用（全部门店可见）", value: "" }, ...bootstrapState.stores.map((s) => ({ label: s.name, value: Number(s.id) }))]);

async function load() {
  await loadBootstrap();
  rows.value = await adminApi.services({ storeId: props.storeId });
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row = {}) {
  openEditor({
    title: row.id ? "编辑服务项目" : "新增服务项目",
    model: {
      id: row.id,
      storeId: row.store_id ? Number(row.store_id) : (props.storeId ? Number(props.storeId) : ""),
      name: row.name || "",
      category: row.category || "",
      description: row.description || "",
      durationMinutes: row.duration_minutes || 60,
      price: row.price || 0,
      coverUrl: row.cover_url || "",
      sortOrder: row.sort_order || 0,
      isActive: row.is_active !== false
    },
    fields: [
      { name: "storeId", label: "所属门店", type: "select", options: storeOptions.value },
      { name: "name", label: "项目名称" },
      { name: "category", label: "分类" },
      { name: "durationMinutes", label: "时长分钟", type: "number" },
      { name: "price", label: "价格", type: "number" },
      { name: "sortOrder", label: "排序", type: "number" },
      { name: "description", label: "项目说明", type: "textarea", wide: true },
      { name: "coverUrl", label: "封面图 URL", wide: true },
      { name: "isActive", label: "是否上架", type: "select", options: statusOptions.bool }
    ],
    submit: adminApi.saveService
  });
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <PageSection title="服务项目" action-text="新增项目" @action="edit()">
    <DataTable
      :columns="[
        { key: 'name', label: '项目' },
        { key: 'store_name', label: '门店' },
        { key: 'category', label: '分类' },
        { key: 'duration_minutes', label: '时长' },
        { key: 'price', label: '价格' },
        { key: 'is_active', label: '状态' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
    >
      <template #store_name="{ row }">{{ row.store_name || "通用" }}</template>
      <template #duration_minutes="{ row }">{{ row.duration_minutes }} 分钟</template>
      <template #price="{ row }">{{ money(row.price) }}</template>
      <template #is_active="{ row }"><StatusPill :value="row.is_active" /></template>
      <template #actions="{ row }"><button class="ghost mini" @click="edit(row)">编辑</button></template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
