<script setup>
import { onMounted, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { money } from "../utils/format";

const props = defineProps({ showToast: Function });
const rows = ref([]);

async function load() {
  rows.value = await adminApi.users();
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row) {
  openEditor({
    title: `配置 ${row.nickname} 的权限`,
    model: { adminRole: row.admin_role || "member", canManage: row.can_manage },
    fields: [
      { name: "adminRole", label: "后台角色", type: "select", options: statusOptions.roles },
      { name: "canManage", label: "显示管理入口", type: "select", options: statusOptions.bool }
    ],
    submit: (model) => adminApi.updateUserRole(row.id, model)
  });
}

onMounted(load);
</script>

<template>
  <PageSection title="会员权限">
    <DataTable
      :columns="[
        { key: 'nickname', label: '用户' },
        { key: 'phone', label: '手机号' },
        { key: 'member_level', label: '会员' },
        { key: 'total_spend', label: '消费' },
        { key: 'appointment_count', label: '预约' },
        { key: 'admin_role', label: '角色' },
        { key: 'can_manage', label: '管理权限' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
    >
      <template #total_spend="{ row }">{{ money(row.total_spend) }}</template>
      <template #can_manage="{ row }"><StatusPill :value="row.can_manage" /></template>
      <template #actions="{ row }"><button class="ghost mini" @click="edit(row)">配置权限</button></template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
