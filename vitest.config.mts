import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    // tests/safety ücretli AI çağrısı yapar: yalnız RUN_AI_TESTS=1 (pnpm test:ai). Atlama değil, ayrı komut.
    include: process.env.RLS_TESTS
      ? ["tests/rls/**/*.test.ts"]
      : process.env.RUN_AI_TESTS
        ? ["tests/safety/**/*.test.ts"]
        : ["tests/unit/**/*.test.ts"],
  },
});
