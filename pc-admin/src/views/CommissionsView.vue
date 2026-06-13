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
const rules = ref([]);
const estimates = ref([]);

const practitionerOptions = computed(() => [{ label: "全部技师", value: "" }, ...bootstrapState.practitioners.map((p) => ({ label: p.name, value: Number(p.id) }))]);
const serviceOptions = computed(() => [{ label: "全部项目", value: "" }, ...bootstrapState.services.map((s) => ({ label: s.name, value: Number(s.id) }))]);

async function load() {
  await loadBootstrap();
  const [ruleRows, dashboard] = await Promise.all([
    adminApi.commissionRules(),
    adminApi.dashboard({ storeId: props.storeId })
  ]);
  rules.value = ruleRows;
  estimates.value = dashboard.commissions || [];
}

const { editor, openEditor, saveEditor } = useCrudEditor({ onSaved: load, showToast: props.showToast });

function edit(row = {}) {
  openEditor({
    title: row.id ? "编辑提成规则" : "新增提成规则",
    model: {
      id: row.id,
      name: row.name || "",
      practitionerId: row.practitioner_id ? Number(row.practitioner_id) : "",
      serviceId: row.service_id ? Number(row.service_id) : "",
      thresholdAmount: row.threshold_amount || 0,
      rate: row.rate || 0.18,
      status: row.status || "active"
    },
    fields: [
      { name: "name", label: "规则名称" },
      { name: "practitionerId", label: "指定技师", type: "select", options: practitionerOptions.value },
      { name: "serviceId", label: "指定项目", type: "select", options: serviceOptions.value },
      { name: "thresholdAmount", label: "业绩门槛", type: "number" },
      { name: "rate", label: "提成比例，例如 0.18", type: "number" },
      { name: "status", label: "状态", type: "select", options: statusOptions.basic }
    ],
    submit: adminApi.saveCommissionRule
  });
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <PageSection title="提成规则" action-text="新增规则" @action="edit()">
    <DataTable
      :columns="[
        { key: 'name', label: '规则' },
        { key: 'practitioner_name', label: '技师' },
        { key: 'service_name', label: '项目' },
        { key: 'threshold_amount', label: '门槛' },
        { key: 'rate', label: '比例' },
        { key: 'status', label: '状态' },
        { key: 'actions', label: '操作' }
      ]"
      :rows="rules"
    >
      <template #practitioner_name="{ row }">{{ row.practitioner_name || "全部" }}</template>
      <template #service_name="{ row }">{{ row.service_name || "全部" }}</template>
      <template #threshold_amount="{ row }">{{ money(row.threshold_amount) }}</template>
      <template #rate="{ row }">{{ Math.round(Number(row.rate) * 100) }}%</template>
      <template #status="{ row }"><StatusPill :value="row.status" /></template>
      <template #actions="{ row }"><button class="ghost mini" @click="edit(row)">编辑</button></template>
    </DataTable>
  </PageSection>

  <PageSection title="本期提成预估">
    <DataTable
      :columns="[
        { key: 'practitioner_name', label: '技师' },
        { key: 'gross_amount', label: '业绩' },
        { key: 'commission_amount', label: '预估提成' }
      ]"
      :rows="estimates"
    >
      <template #gross_amount="{ row }">{{ money(row.gross_amount) }}</template>
      <template #commission_amount="{ row }">{{ money(row.commission_amount) }}</template>
    </DataTable>
  </PageSection>

  <FormDialog :editor="editor" @close="editor.visible = false" @save="saveEditor" />
</template>
