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
import { splitKeywords } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const serviceOptions = computed(() => bootstrapState.services.map((s) => ({ label: s.name, value: Number(s.id) })));

const columns = [
  { key: "name", label: "技师" },
  { key: "store_name", label: "门店" },
  { key: "title", label: "职称" },
  { key: "specialties", label: "擅长" },
  { key: "services", label: "服务项目" },
  { key: "rating", label: "评分" },
  { key: "status", label: "状态" },
  { key: "actions", label: "操作" }
];

async function load() {
  await loadBootstrap();
  rows.value = await adminApi.practitioners({ storeId: props.storeId });
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row = {}) {
  openEditor({
    title: row.id ? "编辑技师" : "新增技师",
    model: {
      id: row.id,
      storeId: row.store_id ? Number(row.store_id) : (props.storeId ? Number(props.storeId) : ""),
      name: row.name || "",
      title: row.title || "",
      rating: row.rating || 5,
      specialties: (row.specialties || []).join("，"),
      bio: row.bio || "",
      serviceIds: (row.services || []).map((s) => Number(s.id)),
      status: row.status || "active"
    },
    fields: [
      { name: "storeId", label: "所属门店", type: "select", options: [{ label: "请选择门店", value: "" }, ...bootstrapState.stores.map((s) => ({ label: s.name, value: Number(s.id) }))] },
      { name: "name", label: "技师姓名" },
      { name: "title", label: "职称" },
      { name: "rating", label: "评分", type: "number" },
      { name: "specialties", label: "擅长方向，逗号分隔", wide: true },
      { name: "bio", label: "简介", type: "textarea", wide: true },
      { name: "serviceIds", label: "可服务项目", type: "checks", options: serviceOptions.value, wide: true },
      { name: "status", label: "状态", type: "select", options: statusOptions.practitioner }
    ],
    submit: (model) => adminApi.savePractitioner({ ...model, specialties: splitKeywords(model.specialties) })
  });
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <PageSection title="技师档案" action-text="新增技师" @action="edit()">
    <DataTable :columns="columns" :rows="rows">
      <template #specialties="{ row }">{{ (row.specialties || []).join("、") || "-" }}</template>
      <template #services="{ row }">{{ (row.services || []).map((s) => s.name).join("、") || "-" }}</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
      <template #actions="{ row }"><button class="ghost mini" @click="edit(row)">编辑</button></template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
