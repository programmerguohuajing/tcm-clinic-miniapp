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
import { money } from "../utils/format";

const props = defineProps({ storeId: [String, Number], showToast: Function });
const activities = ref([]);
const articles = ref([]);
const storeOptions = computed(() => [{ label: "通用/不绑定", value: "" }, ...bootstrapState.stores.map((s) => ({ label: s.name, value: Number(s.id) }))]);

async function load() {
  await loadBootstrap();
  const [activityRows, articleRows] = await Promise.all([
    adminApi.activities({ storeId: props.storeId }),
    adminApi.articles({ storeId: props.storeId })
  ]);
  activities.value = activityRows;
  articles.value = articleRows;
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function addActivity() {
  openEditor({
    title: "新增活动",
    model: { storeId: props.storeId ? Number(props.storeId) : "", title: "", subtitle: "", price: 99, originalPrice: 199, tag: "新客专享", coverUrl: "" },
    fields: [
      { name: "storeId", label: "门店", type: "select", options: storeOptions.value },
      { name: "title", label: "活动标题" },
      { name: "subtitle", label: "副标题", wide: true },
      { name: "price", label: "活动价", type: "number" },
      { name: "originalPrice", label: "原价", type: "number" },
      { name: "tag", label: "标签" },
      { name: "coverUrl", label: "封面图 URL", wide: true }
    ],
    submit: adminApi.createActivity
  });
}

function addArticle() {
  openEditor({
    title: "新增文章",
    model: { storeId: props.storeId ? Number(props.storeId) : "", title: "", category: "节气养生", summary: "", content: "", status: "published" },
    fields: [
      { name: "storeId", label: "门店", type: "select", options: storeOptions.value },
      { name: "title", label: "文章标题" },
      { name: "category", label: "分类" },
      { name: "summary", label: "摘要", wide: true },
      { name: "content", label: "正文", type: "textarea", wide: true },
      { name: "status", label: "状态", type: "select", options: statusOptions.article }
    ],
    submit: adminApi.createArticle
  });
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <PageSection title="活动管理" action-text="新增活动" @action="addActivity">
    <DataTable
      :columns="[
        { key: 'store_name', label: '门店' },
        { key: 'title', label: '活动' },
        { key: 'price', label: '价格' },
        { key: 'tag', label: '标签' },
        { key: 'is_active', label: '状态' }
      ]"
      :rows="activities"
    >
      <template #store_name="{ row }">{{ row.store_name || "通用" }}</template>
      <template #title="{ row }">{{ row.title }}<br /><small>{{ row.subtitle || "" }}</small></template>
      <template #price="{ row }">{{ money(row.price) }}</template>
      <template #is_active="{ row }"><StatusPill :value="row.is_active" /></template>
    </DataTable>
  </PageSection>

  <PageSection title="文章管理" action-text="新增文章" @action="addArticle">
    <DataTable
      :columns="[
        { key: 'store_name', label: '门店' },
        { key: 'title', label: '标题' },
        { key: 'category', label: '分类' },
        { key: 'read_minutes', label: '阅读' },
        { key: 'status', label: '状态' }
      ]"
      :rows="articles"
    >
      <template #store_name="{ row }">{{ row.store_name || "通用" }}</template>
      <template #title="{ row }">{{ row.title }}<br /><small>{{ row.summary || "" }}</small></template>
      <template #read_minutes="{ row }">{{ row.read_minutes }} 分钟</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
    </DataTable>
  </PageSection>

  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
