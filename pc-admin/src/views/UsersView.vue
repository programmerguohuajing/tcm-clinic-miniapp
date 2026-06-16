<script setup>
import { onMounted, reactive, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { money } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const filters = reactive({ keyword: "", adminRole: "", canManage: "" });

async function load() {
  rows.value = await adminApi.users(filters);
}

function resetFilters() {
  filters.keyword = "";
  filters.adminRole = "";
  filters.canManage = "";
  load();
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
  <PageSection title="用户管理">
    <template #actions>
      <div class="toolbar">
        <el-input v-model="filters.keyword" clearable placeholder="昵称 / 手机号" style="width: 180px" @keyup.enter="load" />
        <el-select v-model="filters.adminRole" clearable placeholder="角色" style="width: 150px">
          <el-option v-for="item in statusOptions.roles" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.canManage" clearable placeholder="管理权限" style="width: 140px">
          <el-option label="可管理" :value="true" />
          <el-option label="不可管理" :value="false" />
        </el-select>
        <button class="primary" @click="load">查询</button>
        <button class="ghost" @click="resetFilters">重置</button>
      </div>
    </template>
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
