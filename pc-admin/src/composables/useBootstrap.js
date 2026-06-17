import { reactive } from "vue";
import { adminApi } from "../services/adminApi";

export const bootstrapState = reactive({
  stores: [],
  services: [],
  practitioners: []
});

let bootstrapPromise = null;
let bootstrapLoadedAt = 0;
const BOOTSTRAP_TTL = 5 * 60 * 1000;

function isStale() {
  return Date.now() - bootstrapLoadedAt > BOOTSTRAP_TTL;
}

function applyBootstrap(data) {
  bootstrapState.stores = data.stores || [];
  bootstrapState.services = data.services || [];
  bootstrapState.practitioners = data.practitioners || [];
  bootstrapLoadedAt = Date.now();
  return bootstrapState;
}

export async function loadBootstrap({ force = false } = {}) {
  if (bootstrapLoadedAt && !force && !isStale() && !bootstrapPromise) return bootstrapState;
  if (bootstrapPromise && !force) return bootstrapPromise;

  bootstrapPromise = adminApi.bootstrap()
    .then((data) => {
      return applyBootstrap(data);
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}
