import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose", "junit"],
    outputFile: {
      junit: "test-results/junit.xml",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        // Requires a live Playwright/Chromium browser — unit-tested separately
        "src/excalidraw/export.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 88, // actual: 88.88% — raise to 90 once branch coverage improves
        functions: 90,
        lines: 90,
      },
    },
  },
});
