# OrbitFlame

OrbitFlame is a research console for NASA's microgravity combustion experiments. It turns the public experiment tables from NASA's Physical Science Informatics (PSI) repository (psi.nasa.gov) into something you can search, compare and apply to a habitat: which experiments are most relevant to the ISS, a Moon base, a Mars habitat, an EVA suit or an Earth analog, what each one actually measured, and where the evidence is thin.

Everything on screen comes from real PSI files: **2,051 test rows from 19 files**, covering 17 investigations (20 PSI records with metadata). Values a file does not state are shown as missing, never filled in.

The app is self-contained. You need Node.js and nothing else: no Python, no conda, no database, no API keys.

## Quick start

Prerequisite: **Node.js 20.9 or newer** (Node 22 LTS recommended; `.nvmrc` pins 22). Works on macOS, Linux and Windows.

```bash
git clone <repo-url> OrbitFlame
cd OrbitFlame
npm install
npm run dev
```

Open <http://localhost:3000>.

For a faster, production-style run:

```bash
npm run build
npm start
```

That is all. There is no `.env` to create; every setting is optional (see below).

## Pages

| Page | What it is for |
| --- | --- |
| **Overview** (`/`) | Landing page: what OrbitFlame does, the investigation families and the headline counts from the indexed data. |
| **Compare Lab** (`/compare`) | Put two or three investigations side by side: conditions, fuels, hardware, variables held constant versus varied, and radar / matrix views. |
| **AI Assistant** (`/assistant`) | Ask questions about the experiments. Answers cite specific PSI test rows. Works without any key; an OpenAI key adds a written summary on top. |
| **Mission Lab** (`/mission-lab`) | Habitat Risk and PSI Ranker (ISS, Moon, Mars, EVA, Earth), Flammability and Extinction Lab, Smoke Detection Lab (SAME / SAME-R), and a Scenario Matcher with CSV upload. |
| **Research Explorer** (`/explore`) | Browse and filter all indexed investigations; open any one for its test runs and evidence drawer (`/investigations/PSI-xx`). |
| **Technology Map** (`/technology-map`) | Investigations grouped by Prevention, Detection and Suppression, plus a **Coverage gaps** tab showing what the data does not cover. |
| **Research Library** (`/sources`) | Source catalogue, source-priority rules and dataset validation. |
| **How It Works** (`/how-it-works`) | Methodology: units, conversions, gravity handling, scoring and the evidence rules. |

`/methodology`, `/evidence-rules` and `/evidence-gaps` are redirects to the sections above.

## Optional settings

Copy `.env.example` to `.env` (`cp .env.example .env`, or `copy .env.example .env` on Windows) only if you want to change something. `.env` is gitignored.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | empty | Enables the AI summary in the Assistant and the "Summarize matched evidence" button in Mission Lab. Without it, both fall back to the evidence-only answer and the UI says so. |
| `OPENAI_MODEL` | `gpt-4o-mini` | One of `gpt-4o-mini`, `gpt-4.1-nano`, `gpt-4.1-mini`, `gpt-6-luna`. Anything else falls back to the default. |
| `OPENAI_BUDGET_USD` | `1` | Local soft spend cap, tracked in `.openai_spend.json` (gitignored). Also set a hard limit in the OpenAI dashboard. |
| `OPENAI_PRICE_IN_PER_M`, `OPENAI_PRICE_OUT_PER_M` | built-in guesses | Per-million-token prices used by the cap for `gpt-6-luna`. |
| `NEXT_PUBLIC_API_BASE` | empty | URL of an external backend with the same routes (see "Optional Python backend"). Baked in at build time: restart `npm run dev` or rebuild after changing it. |
| `FASTAPI_URL` | empty | Server-side URL for the external backend's `/api/assistant`, only if different from `NEXT_PUBLIC_API_BASE`. |
| `DEMO_MODE` | `false` | Legacy switch. `true` replaces the NASA data with 12 clearly labelled **fictional** records (`src/lib/demo/dataset.ts`) for UI testing only. Leave it off for real use. |
| `NEXT_PUBLIC_API_BASE_URL` | empty | Legacy browser client (`src/lib/api/client.ts`); no current page uses it. |

## How the data works

There are three layers, tried in this order, and every layer serves the same real PSI data:

1. **Static snapshots** in `public/data/*.json` (committed). They hold the investigations, per-habitat rankings, variable summaries, unit-conversion ledger, provenance, model audit and a bundle of fitted predictors. This is the source of truth for the app.
2. **Built-in API routes** under `src/app/api/**` (same origin, Node runtime). They answer from the snapshots and run the deterministic parts in TypeScript:
   - habitat relevance scoring and the ventilation / limiting-oxygen physics (`src/lib/engine/physics.ts`),
   - the gated empirical predictors: fitted tree models where they beat naive baselines, otherwise the nearest real test rows (`src/lib/engine/predictor.ts`),
   - CSV / ISA-Tab upload parsing and scoring (`src/lib/engine/ingest.ts`).
3. **Optional external backend**, only if you set `NEXT_PUBLIC_API_BASE`. It is tried first with a 2.5 s timeout and the app falls back silently when it is unreachable.

If the app is hosted somewhere without API routes (a purely static host), the browser runs the same engines locally from `/data/*.json`, so predictions and uploads still work.

### Built-in API routes

| Route | Source |
| --- | --- |
| `GET /api/health`, `/api/provenance`, `/api/conversions`, `/api/model-metrics`, `/api/model-audit`, `/api/effective-gravity`, `/api/habitats`, `/api/variable-summary` | snapshots |
| `GET /api/investigations`, `/api/tests`, `/api/row` (filters: `psi_id`, `pillar`, `fuel_phase`, `q`, `limit`, `offset`) | `investigations.json` |
| `GET /api/investigations/{id}`, `/api/investigations/{id}/runs` | investigation records mapped from the snapshot |
| `GET /api/rank?habitat=`, `/api/rank/all`, `POST /api/rank-habitat` | `rankings.json` (every real test row scored against each habitat, with the similarity breakdown) |
| `POST /api/predict/flammability`, `/api/predict-flammability` | physics + predictor bundle, computed per request |
| `GET /api/predict/grid` | physics, computed per request (any gravity from 0 to 2 g) |
| `POST /api/predict/smoke-dust`, `/api/classify-aerosol` | predictor bundle (SAME-R Rt/R0 model, SAME nearest-test lookup) |
| `GET /api/smoke-dust/examples` | `smoke_dust_examples.json` |
| `POST /api/ingest-psi`, `/api/upload` | CSV / TSV / ISA-Tab TXT parsed in memory, never stored |
| `POST /api/assistant`, `/api/mission-explain` | evidence-only answers; OpenAI synthesis if a key is set |

`GET /api` lists them all. With the server running, `npm run check:api` (optionally `-- http://localhost:3100`) requests every page and every route and exits non-zero on the first sign of trouble.

### What the predictors are, and are not

Of 16 candidate predictors trained on the PSI tables, 10 beat naive baselines under group cross-validation and run as fitted models (FLEX burning rate and extinction, ACME CFI-G self-extinguish and burn time, CFI droplet burning-rate constant and extinction diameter, SAME-R Rt/R0). The other 6 return the **nearest real experimental tests** with their measured outcomes and file / row provenance, clearly labelled "lookup". Ties in the nearest-test ranking are broken by table row order. Flame-spread rate, flammability probability and particle-size / dust discrimination are not predicted because the PSI tables contain no such labels. The limiting-oxygen index shown in Mission Lab is analytical physics, not learned from PSI rows.

### Gravity

Every PSI row is ISS or Cygnus flight data at actual gravity 0 g (project baseline, flagged as inferred). The 0.16 g, 0.38 g and 1 g views use an **effective-gravity heuristic proxy** (a forced-flow speed mapped to the gravity that would drive the same buoyant velocity). It is a bookkeeping device, not measured partial-gravity data, and the UI labels it as such.

## Data provenance and policy

- Every row comes from a file downloaded from psi.nasa.gov (experiment tables and ISA-Tab metadata); the file, sheet and row of each data point are carried through to the UI.
- **No synthetic data.** Nothing is generated, imputed or calibrated. Unmeasured fields stay null.
- Units are converted only where the file's own header states the unit (see `/api/conversions`, 68 logged decisions). Anything else is left unconverted.
- Model outputs are research triage, not a certified fire-safety determination.

`docs/` holds the original design notes; `docs/IMPLEMENTATION_PLAN.md` is a historical log from before the real data was connected.

## Optional Python backend

The snapshots and the predictor bundle were produced by a separate Python research pipeline (DuckDB tables, scikit-learn models). That pipeline is not needed to run OrbitFlame and is not included here. If you have it, its FastAPI server exposes the same `/api/...` routes; run it on port 8000, set `NEXT_PUBLIC_API_BASE=http://localhost:8000` in `.env`, and restart. It adds, over the built-in API:

- Excel (`.xlsx`) upload parsing (the built-in parser reads CSV, TSV and ISA-Tab TXT),
- live database queries instead of committed snapshots, and retraining of the models,
- exact `numpy` tie ordering in nearest-test lookups.

`scripts/export_predictor_bundle.py` regenerates `public/data/predictor_bundle.json` from that pipeline's trained artifact. It is a maintainer tool and is not run by `npm`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 with hot reload. |
| `npm run build` | Production build (webpack). |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript type check. |
| `npm run check:api` | Smoke test of every page and API route on a running server. |

Use another port with `npm run dev -- -p 3100` or `npm start -- -p 3100`.

## Troubleshooting

- **`Unsupported engine` / syntax errors on start.** Your Node is too old. Check `node -v` (needs 20.9+); with nvm run `nvm install` then `nvm use` in the project folder.
- **Port 3000 is in use.** Start on another port: `npm run dev -- -p 3100`.
- **The assistant says AI synthesis is off.** That is the normal state without `OPENAI_API_KEY`; answers still work. Set the key in `.env` and restart to enable summaries.
- **`NEXT_PUBLIC_API_BASE` change has no effect.** It is read at build time. Restart `npm run dev`, or run `npm run build` again.
- **The page shows "STATIC SNAPSHOT" instead of "BUILT-IN API".** The browser could not reach `/api/health`: usually a static host, a proxy that blocks `/api`, or a stopped server. Predictions and uploads still work in the browser.
- **Windows.** Use PowerShell or cmd; the scripts avoid shell-specific syntax. If `npm install` fails on long paths, clone closer to the drive root (for example `C:\src\OrbitFlame`). The landing page needs a browser with WebGL enabled.
- **Blank or slow 3D visuals.** The landing page uses WebGL. In a VM or with hardware acceleration turned off, expect it to be slow; enable hardware acceleration in the browser if you can.
- **Clean reinstall.** Delete `node_modules` and `.next`, then `npm install` again.
