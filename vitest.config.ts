import { defineConfig } from "vitest/config";

/** Logic checks: plain Node, no browser. The robot (end-to-end) tests live in tests/e2e and run under Playwright instead. */
export default defineConfig({
    test: {
        include: ["tests/unit/**/*.test.ts"],
        setupFiles: ["tests/unit/setup.ts"],
        environment: "node",
    },
});
