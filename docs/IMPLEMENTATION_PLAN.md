# FLAME Intelligence — Implementation Plan

## Phase 0 — Reconnaissance and requirements analysis

### Functional requirements
- Research collection dashboard; explorer; investigation and test-run detail; compare 2–3 records; evidence-grounded assistant; mission matcher; evidence gaps; prevention/detection/suppression map; sources/methodology; optional briefs and protected ingestion.
- Preserve source provenance and explicit missing states from ingestion through every displayed claim or metric.

### Visual requirements
- Deep graphite/space surfaces; restrained amber for flame/action, cyan/blue for data, verified green only for verified evidence; Plus Jakarta Sans with JetBrains Mono for scientific identifiers and units.
- Desktop-first shell with usable tablet/mobile layouts; reusable panels/cards/tables/badges; consistent tokens and empty/loading/error states.
- Futuristic mission-instrument aesthetic, grounded in real research tasks.

### Interaction requirements
- Keyboard-accessible navigation, focus, filters, citations and source drawers; explicit comparison states; reduced-motion support.
- One reusable WebGL canvas foundation; lazy-load 3D, avoid idle rendering, capability tiers and a static fallback.
- Keep 3D actions available as DOM controls; label conceptual imagery; no automatic camera movement.

### Scientific assumptions and constraints
- No source package has been supplied yet. The official challenge resource package may arrive later; do not imply full archive coverage.
- No flame geometry/color/soot characteristic is universal. Flame imagery stays conceptual unless tied to verified source material.
- No hypothetical mission O₂, pressure, airflow or gravity values are prefilled. No physical simulation, risk rating or safety prediction is in scope.
- CIR and Saffire configurations must stay distinct and only be represented from verified documentation. No NASA hardware model has been supplied.
- Demo mode may contain labelled fixtures; this foundation intentionally uses an empty fixture rather than fabricated experiments.

### Technical dependencies selected
- Next.js App Router + React + TypeScript strict mode; Tailwind CSS v4; Radix tooltip primitive and Lucide icons; React Three Fiber/Three.js; GSAP; Recharts; TanStack Query; Zod.
- Versions are declared as semver ranges in `package.json`; resolved versions are locked in `package-lock.json` after installation.
- React Three Fiber provides a single page-level `Canvas` foundation. A route-level dynamic boundary and shared scene host will be added before multiple simultaneous 3D visualizations are introduced.

### API gaps
- PRD lists endpoint intentions and example payloads, but no agreed API host, authentication, pagination response envelope, field-level DTOs, error schema, filtering semantics, upload contract or data package exists.
- The client therefore centralizes base URL configuration, validation and safe errors. It does not invent or call final endpoints. An empty mock adapter establishes the integration seam.

### Conflicts resolved
- Initial design system proposed 40k particles, simulated telemetry and combining CIR/Saffire. This conflicts with the scientific integrity rules. Foundation defers particle scene work, uses no telemetry values, and does not create an apparatus model.
- Design system described spherical blue/sootless microgravity flames and fixed mission values. These are condition-dependent and unsupported as general claims. The starter graphic is explicitly conceptual and carries no scientific labels.
- The product stack recommends Next.js 14+ and the supplied build instruction asks stable compatible packages. The scaffold uses the current declared versions at initialization; exact resolutions are recorded by npm lockfile.

## Ordered implementation plan

1. **Foundation (current):** app shell, responsive navigation, tokens, basic shared components, empty dataset state, WebGL scene wrapper, Zod API seam, query provider, docs and environment template.
2. **Data contract:** reconcile field DTOs and API envelopes with data engineering; add fixtures only after provenance review.
3. **Research vertical slice:** dashboard summary, explorer, investigation detail, test-run evidence drawer, source navigation.
4. **Compare and deterministic ranking:** compatible-dimension matrix, missing-value handling and explainable match breakdown.
5. **Assistant:** provider adapter, retrieval contract, claim/citation validation and abstention states.
6. **Mission Lab, gaps and technology map:** implement only with reviewed source taxonomy and clear evidence scope.
7. **Selective 3D:** add the 2D experience first, then low-cost 3D enhancements with real fallback and measured performance.
8. **Release preparation:** ingestion, full test plan, deployment setup, judge demo narrative.

## Environment configuration

- `NEXT_PUBLIC_API_BASE_URL`: API base URL after the contract is supplied.
- `NEXT_PUBLIC_DEMO_MODE`: UI/data mode indicator. It does not enable fabricated measurements.
- Runtime LLM/database secrets are intentionally not introduced in this phase.

## Phase 1 exit conditions

- App shell and empty state render without scientific placeholder data.
- No final API endpoint is hard-coded.
- Strict TypeScript, lint and production build complete successfully.
- Responsive behavior and the 3D fallback are manually inspectable.

## Phase 1 verification — 7 November 2026

- `npm install --ignore-scripts --no-audit --no-fund`: completed; `package-lock.json` generated.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: **passed and verified**. The initial failure (`not a valid Win32 application` / missing Lightning CSS module) was caused by incomplete/truncated binary downloads on drive M: (`next-swc` was 3.7 MB instead of 110.2 MB; `lightningcss` was 3.4 MB instead of 9.5 MB). Both clean, intact `win32-x64-msvc` packages were re-extracted and verified in place. Next.js production build compiled successfully and generated all static routes without errors.
- Phase 1 exit conditions are fully satisfied. Ready to proceed to Phase 2 (Data contract & ingestion).

## Phase 2 progress — frontend data contract foundation

- Added Zod types for investigation, test run, condition, measurement, provenance, evidence level, and source locator.
- Added an import preview validator that returns per-row parse issues and integrity warnings. It does not persist or claim external source verification.
- Added a draft data dictionary and described the API contract gaps.
- No NASA fixtures were added because the project directory contains no official resource package. The empty mock adapter remains the truthful state.
- `npm run lint`: passed.
- `npm run build`: passed; Dashboard and not-found routes prerendered.
- `npm run typecheck`: passed on a sequential rerun. The initial concurrent run collided with Next's generated `.next/types` output during the build; rerunning after build completion passed.
- Remaining for Phase 2: agree DTOs and API envelope with data engineering; build an import parser/mapping layer only once the supplied package format is known; add persistent storage/import job log after the backend choice is confirmed.

## Browser QA — 7 November 2026

- Fixed the development-server build error found in the browser: removed `next/font/google` runtime font fetching and retained the requested Plus Jakarta Sans / JetBrains Mono stacks with local system fallbacks. The dashboard rendered after refresh.
- Desktop dashboard: confirmed 12 fixture investigations, 12 illustrative runs, 0 source documents, 0 verified evidence spans; category distribution rendered as Prevention 6, Detection 4, Suppression 2, with demo labels.
- Explore: confirmed 12 initial results; text search `SAME` returned 4; BASS family returned 3; Detection returned 4; completeness sort placed 100% items before 67% and 0% items. Counts updated with each action.
- Detail: opened D-009 and confirmed fixture title/category, fictional label, missing oxygen/pressure/airflow displayed as `NOT REPORTED / DEMO_MISSING`, and no source references. Invalid ID displayed Next.js 404.
- Navigation: Dashboard → Explore and detail route links were visible; detail included Back to Explore. Other unimplemented navigation entries still point to `#` and were not treated as part of this scoped QA.
- Visual inspection: dark navy panels, amber primary emphasis, cyan metadata, readable labels, repeated demo warnings. A desktop-sized screenshot was captured during browser QA.
- Not completed: empty-query-result recovery action, second detail record, mobile viewport inspection, browser console/network panel review, and systematic link audit. The available CUA browser surface did not expose viewport emulation or console/network inspection; no claim is made that these checks passed. The screenshot capture was shown in the browser tool output and was not saved as a separate deliverable image.
- `npm run lint`, `npm run build`, and `npm run typecheck`: passed after the font fix.
- Remaining limitations: gravity filter is intentionally disabled; no loading/API-error states can be exercised because demo reads are local and synchronous; Compare and Evidence Gap Radar remain unimplemented.
- Recommended next phase: finish responsive/console QA with viewport emulation, close out this QA checklist, then proceed only after owner approval.

## Demo dataset implementation — 7 November 2026

- Created 12 fictional records across BASS, SAFFIRE, FLEX, ACME, and SAME families in `src/lib/demo/dataset.ts`.
- Added the `DEMO_MODE` switch and `InvestigationRepository` seam in `src/lib/data/repository.ts`. Demo fixtures are isolated from the production API adapter.
- Wired Dashboard, `/explore`, and `/investigations/[id]` to the selected repository. Explore supports search, family/domain filters, sorting by name/completeness, and result counts.
- Every demo view is labelled `DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS`. Dashboard counts/coverage derive from fixtures; source and verified-evidence counts remain zero.
- Missing values render as `NOT REPORTED / DEMO_MISSING`. Invalid IDs use the not-found route. No fabricated NASA references or URLs are present.
- `npm run lint`, `npm run typecheck`, and `npm run build`: passed.
- Remaining: interactive browser testing at desktop/mobile sizes is not yet performed. Compare and Evidence Gap Radar do not exist in the current project and were not added in this scoped task. Production adapter awaits the real API contract.

