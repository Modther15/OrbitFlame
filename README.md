# OrbitFlame

AI-Powered Intelligence for Microgravity Combustion Research.

OrbitFlame is a Next.js research-console prototype for exploring combustion investigations. The current build uses a clearly labelled fictional demo dataset so the interface can be tested before verified NASA APIs are connected.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo data

Demo mode is enabled by default through `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`. All fixture records and visualizations are labelled:

> DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS

The demo repository is isolated behind the data adapter in `src/lib/data/repository.ts`, so a production API adapter can replace it without rewriting the UI.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

This repository intentionally excludes local reference videos, PRD source files, build output, caches, and other non-runtime artifacts.
