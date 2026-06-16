import { reactive } from "vue";
import { adminApi } from "../services/adminApi";

export const bootstrapState = reactive({
  stores: [],
  services: [],
  practitioners: []
});

let bootstrapPromise = null;
let bootstrapLoaded = false;

function applyBootstrap(data) {
  bootstrapState.stores = data.stores || [];
  bootstrapState.services = data.services || [];
  bootstrapState.practitioners = data.practitioners || [];
  return bootstrapState;
}

export async function loadBootstrap({ force = false } = {}) {
  if (bootstrapLoaded && !force) return bootstrapState;
  if (bootstrapPromise && !force) return bootstrapPromise;

  bootstrapPromise = adminApi.bootstrap()
    .then((data) => {
      bootstrapLoaded = true;
      return applyBootstrap(data);
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}
