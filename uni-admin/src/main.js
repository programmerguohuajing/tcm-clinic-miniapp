import { createSSRApp } from "vue";
import App from "./App.vue";
import "./styles.css";

if (typeof window !== "undefined") {
  const isKnownUniSlotError = (message) => String(message || "").includes("Cannot assign to read only property '_'");
  const consoleError = console.error.bind(console);

  console.error = (...args) => {
    if (args.some((arg) => isKnownUniSlotError(arg?.message || arg))) return;
    consoleError(...args);
  };

  window.onerror = (message) => (isKnownUniSlotError(message) ? true : undefined);
  window.addEventListener("error", (event) => {
    if (isKnownUniSlotError(event.message)) {
      event.preventDefault();
    }
  }, true);
}

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
