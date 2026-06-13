import { reactive } from "vue";
import { adminApi } from "../services/adminApi";

export const bootstrapState = reactive({
  stores: [],
  services: [],
  practitioners: []
});

export async function loadBootstrap() {
  const data = await adminApi.bootstrap();
  bootstrapState.stores = data.stores || [];
  bootstrapState.services = data.services || [];
  bootstrapState.practitioners = data.practitioners || [];
  return bootstrapState;
}
