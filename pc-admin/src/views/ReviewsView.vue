<script setup>
import { onMounted, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { adminApi } from "../services/adminApi";

const props = defineProps({ showToast: Function });
const rows = ref([]);

async function load() {
  rows.value = await adminApi.reviews();
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row) {
  openEditor({
    title: `回复 ${row.user_name || "用户"} 的评价`,
    model: {
      id: row.id,
      reply: row.reply || "",
      status: row.status || "visible"
    },
    fields: [
      { name: "reply", label: "门店回复", type: "textarea", wide: true },
      { name: "status", label: "展示状态", type: "select", options: [
        { label: "显示", value: "visible" },
        { label: "隐藏", value: "hidden" }
      ] }
    ],
    submit: (model) => adminApi.updateReview(model.id, model)
  });
}

onMounted(load);
</script>

<template>
  <PageSection title="评价管理">
    <DataTable
      :columns="[
        { key: 'user_name', label: '用户' },
        { key: 'store_name', label: '门店' },
        { key: 'practitioner_name', label: '技师' },
        { key: 'rating', label: '评分' },
        { key: 'content', label: '内容' },
        { key: 'reply', label: '回复' },
        { key: 'status', label: '状态' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
    >
      <template #rating="{ row }">{{ "★".repeat(row.rating || 0) }}</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
      <template #actions="{ row }"><button class="ghost mini" @click="edit(row)">回复/隐藏</button></template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
