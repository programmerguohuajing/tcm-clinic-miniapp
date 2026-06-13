<script setup>
import { onMounted, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { adminApi } from "../services/adminApi";
import { statusOptions } from "../constants/status";

const props = defineProps({ showToast: Function });
const rows = ref([]);

const columns = [
  { key: "name", label: "门店" },
  { key: "city", label: "城市" },
  { key: "address", label: "地址" },
  { key: "phone", label: "电话" },
  { key: "business_hours", label: "营业时间" },
  { key: "status", label: "状态" },
  { key: "actions", label: "操作" }
];

async function load() {
  rows.value = await adminApi.stores();
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row = {}) {
  openEditor({
    title: row.id ? "编辑门店" : "新增门店",
    model: {
      id: row.id,
      name: row.name || "",
      city: row.city || "",
      address: row.address || "",
      phone: row.phone || "",
      businessHours: row.business_hours || "",
      isDefault: row.is_default || false,
      status: row.status || "active"
    },
    fields: [
      { name: "name", label: "门店名称" },
      { name: "city", label: "城市" },
      { name: "address", label: "详细地址", wide: true },
      { name: "phone", label: "联系电话" },
      { name: "businessHours", label: "营业时间" },
      { name: "isDefault", label: "默认门店", type: "select", options: statusOptions.bool },
      { name: "status", label: "状态", type: "select", options: statusOptions.basic }
    ],
    submit: adminApi.saveStore
  });
}

onMounted(load);
</script>

<template>
  <PageSection title="门店列表" action-text="新增门店" @action="edit()">
    <DataTable :columns="columns" :rows="rows">
      <template #status="{ row }">
        <StatusPill :value="row.status" />
        <StatusPill v-if="row.is_default" value="默认" />
      </template>
      <template #actions="{ row }">
        <button class="ghost mini" @click="edit(row)">编辑</button>
      </template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
