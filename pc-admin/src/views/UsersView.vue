<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { statusOptions } from "../constants/status";
import { adminApi } from "../services/adminApi";
import { getCurrentUser } from "../services/auth";
import { money } from "../utils/format";
import { ElMessageBox, ElMessage } from "element-plus";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const loading = ref(false);
const filters = reactive({ keyword: "", adminRole: "", canManage: "" });

// 角色判定：owner = 平台总部；tenant_admin = 商户管理员（管理本商户）
// 开发免登录（无角色）时按 owner 处理，便于调试
const _role = getCurrentUser()?.admin_role || "";
const isOwnerDev = _role === "owner" || _role === "";
const isTenantAdmin = _role === "tenant_admin";
// 「新增用户」：平台 owner 或商户管理员可见
const canCreateUser = isOwnerDev || isTenantAdmin;

// 归属商户选项（平台 owner 设置商户管理员 / 新增用户时使用）
const tenantOptions = ref([]);
const tenantSelectOptions = computed(() => [
  { label: "不归属（平台用户）", value: null },
  ...tenantOptions.value
]);
async function loadTenants() {
  try {
    tenantOptions.value = (await adminApi.tenants()).map(t => ({ label: t.name, value: t.id }));
  } catch (_e) { /* 下拉兜底：拉取失败不阻塞页面 */ }
}

// 角色值→中文映射
const roleLabelMap = Object.fromEntries(statusOptions.roles.map(r => [r.value, r.label]));

async function load() {
  loading.value = true;
  try {
    rows.value = await adminApi.users(filters);
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.keyword = "";
  filters.adminRole = "";
  filters.canManage = "";
  load();
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row) {
  const fields = [
    { name: "adminRole", label: "后台角色", type: "select", options: statusOptions.roles },
    { name: "canManage", label: "显示管理入口", type: "select", options: statusOptions.bool }
  ];
  if (isOwnerDev) {
    // 设为「商户管理员」的入口：角色选 tenant_admin + 指定归属商户
    fields.push({ name: "tenantId", label: "归属商户（设为商户管理员时必选）", type: "select", options: tenantSelectOptions.value });
  }
  openEditor({
    title: `配置 ${row.nickname} 的权限`,
    model: { adminRole: row.admin_role || "member", canManage: row.can_manage, tenantId: row.tenant_id ?? null },
    fields,
    submit: (model) => adminApi.updateUserRole(row.id, model)
  });
}

function addUser() {
  const fields = [
    { name: "phone", label: "手机号", required: true },
    { name: "nickname", label: "昵称" },
    { name: "memberLevel", label: "会员等级" },
    { name: "points", label: "积分", type: "number", min: 0 }
  ];
  if (!isTenantAdmin) {
    // 平台 owner：可指定角色 / 管理入口 / 归属商户
    fields.push(
      { name: "adminRole", label: "后台角色", type: "select", options: statusOptions.roles },
      { name: "canManage", label: "显示管理入口", type: "select", options: statusOptions.bool },
      { name: "tenantId", label: "归属商户", type: "select", options: tenantSelectOptions.value }
    );
  }
  // 商户管理员：只建本商户普通用户（后端强制 admin_role=member / can_manage=false）
  openEditor({
    title: "新增用户",
    model: { phone: "", nickname: "", memberLevel: "", adminRole: "member", canManage: false, points: 0, tenantId: null },
    fields,
    submit: (model) => {
      const payload = { ...model };
      if (payload.tenantId === null || payload.tenantId === "") delete payload.tenantId;
      return adminApi.createUser(payload);
    }
  });
}

async function removeUser(row) {
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.nickname}」？删除后无法恢复。`, "删除用户", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  try {
    await adminApi.deleteUser(row.id);
    ElMessage.success("用户已删除");
    load();
  } catch (error) {
    props.showToast?.(error.message || "删除失败");
  }
}

onMounted(() => {
  load();
  if (isOwnerDev) loadTenants();
});
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
        <button v-if="canCreateUser" class="primary" @click="addUser">新增用户</button>
      </div>
    </template>
    <DataTable
      :columns="[
        { key: 'nickname', label: '用户' },
        { key: 'phone', label: '手机号' },
        { key: 'member_level', label: '会员' },
        { key: 'tenant_name', label: '归属商户' },
        { key: 'total_spend', label: '消费' },
        { key: 'appointment_count', label: '预约' },
        { key: 'admin_role', label: '角色' },
        { key: 'can_manage', label: '管理权限' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rows"
      :loading="loading"
    >
      <template #total_spend="{ row }">{{ money(row.total_spend) }}</template>
      <template #can_manage="{ row }"><StatusPill :value="row.can_manage" /></template>
      <template #admin_role="{ row }">{{ roleLabelMap[row.admin_role] || row.admin_role }}</template>
      <template #actions="{ row }">
        <div class="actions">
          <button v-if="isOwnerDev" class="ghost mini" @click="edit(row)">配置权限</button>
          <button v-if="isOwnerDev" class="danger mini" @click="removeUser(row)">删除</button>
        </div>
      </template>
    </DataTable>
  </PageSection>
  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
