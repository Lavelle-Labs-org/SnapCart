import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@order-by-sms/contracts": path.resolve(__dirname, "./packages/contracts/src/index.ts"),
    },
  },
});
