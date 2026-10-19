import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../packages/core/src");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: /^@shadow-ai\/core$/, replacement: path.join(core, "index.ts") },
    ],
  },
});
