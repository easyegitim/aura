import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    include: process.env.RLS_TESTS
      ? ["tests/rls/**/*.test.ts"]
      : ["tests/unit/**/*.test.ts", "tests/safety/**/*.test.ts"],
  },
});
