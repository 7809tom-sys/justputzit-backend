import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@shared": path.resolve(root, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "migration/**/*.test.ts"],
  },
});
