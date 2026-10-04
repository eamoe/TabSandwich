import { defineConfig } from "vitest/config";

/** Logic and component checks, no real browser. The robot (end-to-end) tests live in tests/e2e and run under Playwright instead. */
export default defineConfig({
    test: {
        // Logic tests run in plain Node. Component tests (*.test.tsx) opt into a simulated DOM
        // with a `// @vitest-environment happy-dom` comment at the top of the file.
        include: ["tests/unit/**/*.test.{ts,tsx}"],
        setupFiles: ["tests/unit/setup.ts"],
        environment: "node",
    },
    oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
});
