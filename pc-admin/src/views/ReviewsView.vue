<script setup>
import { onMounted, reactive, ref } from "vue";
import DataTable from "../components/DataTable.vue";
import FormDialog from "../components/FormDialog.vue";
import PageSection from "../components/PageSection.vue";
import StatusPill from "../components/StatusPill.vue";
import { useCrudEditor } from "../composables/useCrudEditor";
import { adminApi } from "../services/adminApi";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const rows = ref([]);
const filters = reactive({ keyword: "", status: "", rating: "" });
const reviewStatusOptions = [
  { label: "显示", value: "visible" },
  { label: "隐藏", value: "hidden" }
];
const ratingOptions = [1, 2, 3, 4, 5].map((value) => ({ label: `${value} 星`, value }));

async function load() {
  rows.value = await adminApi.reviews(filters);
}

function resetFilters() {
  filters.keyword = "";
  filters.status = "";
  filters.rating = "";
  load();
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
      { name: "status", label: "展示状态", type: "select", options: reviewStatusOptions }
    ],
    submit: (model) => adminApi.updateReview(model.id, model)
  });
}

onMounted(load);
</script>

<template>
  <PageSection title="评价管理">
    <template #actions>
      <div class="toolbar">
        <el-input v-model="filters.keyword" clearable placeholder="内容 / 用户 / 技师" style="width: 190px" @keyup.enter="load" />
        <el-select v-model="filters.status" clearable placeholder="展示状态" style="width: 130px">
          <el-option v-for="item in reviewStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.rating" clearable placeholder="评分" style="width: 110px">
          <el-option v-for="item in ratingOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <button class="primary" @click="load">查询</button>
        <button class="ghost" @click="resetFilters">重置</button>
      </div>
    </template>
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
