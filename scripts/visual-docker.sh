#!/bin/sh
# Runs the screenshot comparisons (playwright.visual.config.ts) inside Playwright's Docker image —
# the same image CI uses — so they render exactly as they do there. Pass --update-snapshots to
# approve new pictures after an intended visual change.
#
# The image tag must match @playwright/test's version in package.json (and checks.yml's
# visual job). Linux node_modules live in a Docker volume, never in the project folder, so the
# Mac's own install keeps working.
set -e
IMAGE=mcr.microsoft.com/playwright:v1.63.0-noble
docker run --rm --ipc=host \
  -v "$(pwd)":/work \
  -v tabsandwich-linux-node-modules:/work/node_modules \
  -v tabsandwich-linux-pnpm-store:/root/.local/share/pnpm \
  -w /work \
  "$IMAGE" \
  sh -c "corepack enable >/dev/null 2>&1 && pnpm install --frozen-lockfile --config.confirmModulesPurge=false && pnpm build && pnpm test:visual $*"
