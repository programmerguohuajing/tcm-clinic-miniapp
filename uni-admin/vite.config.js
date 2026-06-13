import { defineConfig } from "vite";
import uniModule from "@dcloudio/vite-plugin-uni";

const uni = uniModule.default;

export default defineConfig({
  base: "/h5-admin/",
  plugins: [uni()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  }
});
