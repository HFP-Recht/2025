import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@hfp/prompt-engine": fileURLToPath(new URL("../packages/prompt-engine/src/index.ts", import.meta.url))
    }
  },
  test: {
    include: ["tests/**/*.unit.test.ts", "tests/**/*.test.ts"],
    environment: "node"
  }
});
