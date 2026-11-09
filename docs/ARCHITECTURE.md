# FLAME Intelligence Architecture — Foundation

## System shape

```text
Next.js App Router
  ├─ route/layout shell ─ shared navigation and visual system
  ├─ presentation components ─ cards, status badges, panels
  ├─ visualization layer ─ isolated React Three Fiber canvas; Recharts later
  ├─ API client ─ centralized base URL, safe error mapping, Zod DTO validation
  ├─ mock adapter ─ empty collection until a reviewed fixture package exists
  ├─ schemas ─ provenance labels and API boundary types
  └─ query provider ─ cache/retry defaults for future asynchronous data
```

## Design principles

- Route components own composition; reusable components do not fetch data.
- API access and response validation live under `src/lib/api`, independent of view code.
- Unknown, not reported, demo, illustrative, and verified states have distinct vocabulary.
- Imported research text is untrusted; render it as escaped text unless a future sanitized rich-text policy is added.
- Secrets never use `NEXT_PUBLIC_`. Only non-secret API configuration belongs in public environment variables.
- Charts must carry units, source references, and accessible text/table equivalents when added.

## WebGL foundation

`src/components/visualization-3d/canvas-stage.tsx` owns the initial page-level canvas. It caps device pixel ratio, disables expensive antialiasing, reacts to live reduced-motion preference, supports pause, and falls back to a static message. It intentionally contains one simple conceptual wireframe; no particle system, experimental data, or NASA hardware geometry is implemented.

For later routes, create a client-only lazy boundary around scenes and keep only one active canvas mounted where practical. Scene activation should be viewport/route driven; dispose GPU resources on unmount. If multiple visualizations must appear together, share a canvas and render regions only after the combined scene lifecycle is validated.

## API contract boundary

`NEXT_PUBLIC_API_BASE_URL` configures a host; no final endpoint paths are assumed. `apiRequest` accepts a caller-supplied Zod-compatible parser, maps errors to `ApiClientError`, and does not expose response internals. `mockApi.getDatasetSummary` returns an explicit empty collection. Replace it only after data engineering provides an agreed contract and provenance-reviewed fixture set.

## Accessibility and responsive layout

- Navigation uses real anchors and labels.
- Keyboard focus uses a visible cyan focus ring.
- Canvas has accessible image semantics and a description; its control is keyboard operable.
- Reduced motion updates while the app is open.
- At narrow widths, navigation is a horizontally scrollable labelled set and content stacks into one column.

## Deferred decisions

- Actual API DTOs, authentication, and error envelope.
- Whether the production design will use Supabase directly or a separately hosted API.
- Source document viewer and storage contract.
- Exact 3D renderer sharing strategy for multiple route scenes; foundation starts with one canvas on the dashboard.
- shadcn/ui generation strategy. Current reusable primitives are small local components with Radix available for accessible overlays/tooltips; generated shadcn component set is deferred until concrete screens need it.

