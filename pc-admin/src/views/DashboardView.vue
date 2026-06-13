<script setup>
import { onMounted, ref, watch } from "vue";
import MetricCard from "../components/MetricCard.vue";
import RankCard from "../components/RankCard.vue";
import { adminApi } from "../services/adminApi";
import { money } from "../utils/format";

const props = defineProps({
  storeId: [String, Number],
  showToast: Function
});

const loading = ref(true);
const errorMessage = ref("");
const data = ref({
  cards: {},
  storeRank: [],
  practitionerRank: [],
  serviceRank: [],
  commissions: []
});

async function load() {
  loading.value = true;
  errorMessage.value = "";
  try {
    data.value = await adminApi.dashboard({ storeId: props.storeId });
  } catch (error) {
    errorMessage.value = error.message || "经营看板加载失败";
    props.showToast?.(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.storeId, load);
</script>

<template>
  <div v-if="loading" class="empty">正在调取经营脉络...</div>
  <div v-else-if="errorMessage" class="empty">
    {{ errorMessage }}
    <div style="margin-top: 14px;">
      <button class="ghost mini" @click="load">重新加载</button>
    </div>
  </div>
  <template v-else>
    <div class="grid cards">
      <MetricCard label="营业额" :value="money(data.cards.revenue)" />
      <MetricCard label="预约订单" :value="data.cards.orders" />
      <MetricCard label="服务用户" :value="data.cards.served_users" />
      <MetricCard label="客单价" :value="money(data.cards.avg_order)" />
    </div>
    <div class="grid two section-headless">
      <RankCard title="门店收入排行" :rows="data.storeRank" label-key="store_name" value-key="revenue" />
      <RankCard title="技师业绩排行" :rows="data.practitionerRank" label-key="practitioner_name" value-key="revenue" />
    </div>
    <div class="grid two section-headless">
      <RankCard title="项目销售排行" :rows="data.serviceRank" label-key="service_name" value-key="orders" />
      <RankCard title="提成预估排行" :rows="data.commissions" label-key="practitioner_name" value-key="commission_amount" />
    </div>
  </template>
</template>
