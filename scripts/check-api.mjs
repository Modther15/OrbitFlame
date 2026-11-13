#!/usr/bin/env node
/**
 * Smoke test for the built-in API and the page routes of a RUNNING OrbitFlame server.
 *   npm run dev            (or: npm run build && npm start)
 *   npm run check:api                       # defaults to http://localhost:3000
 *   npm run check:api -- http://localhost:3100
 * Exits with code 1 if any check fails. Needs Node 20+ only (no dependencies).
 * Note: the last check calls the assistant route; if OPENAI_API_KEY is set on the server that is one small OpenAI request.
 */
const base = (process.argv[2] || process.env.ORBITFLAME_URL || "http://localhost:3000").replace(/\/$/, "");
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS  ${name}${detail ? "  " + detail : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}  ${e instanceof Error ? e.message : e}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function getJson(path) {
  const res = await fetch(base + path);
  assert(res.status === 200, `HTTP ${res.status}`);
  return res.json();
}
async function postJson(path, body) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert(res.status === 200, `HTTP ${res.status}`);
  return res.json();
}

const pages = ["/", "/compare", "/assistant", "/mission-lab", "/explore", "/technology-map", "/investigations/PSI-25", "/sources", "/how-it-works", "/methodology", "/evidence-rules", "/evidence-gaps"];
for (const p of pages) {
  await check(`page ${p}`, async () => {
    const res = await fetch(base + p);
    assert(res.status === 200, `HTTP ${res.status}`);
    const html = await res.text();
    assert(html.length > 2000, "suspiciously small page");
    assert(!/Application error|Internal Server Error/i.test(html), "error screen rendered");
  });
}

let firstPsi = "PSI-25";
await check("GET /api/health", async () => {
  const j = await getJson("/api/health");
  assert(j.status === "ok" && j.row_count > 0, "bad health payload");
  return `${j.row_count} rows, ${j.source_file_count} files`;
});
await check("GET /api/investigations", async () => {
  const j = await getJson("/api/investigations?limit=3");
  assert(j.total > 0 && j.rows.length === 3 && j.investigation_meta.length > 0, "bad payload");
  firstPsi = j.rows[0].psi_id;
  return `total ${j.total}`;
});
await check("GET /api/investigations?psi_id=", async () => {
  const j = await getJson(`/api/investigations?psi_id=${firstPsi}&limit=5`);
  assert(j.total > 0 && j.rows.every((r) => r.psi_id === firstPsi), "filter failed");
});
await check("GET /api/investigations/{id}", async () => {
  const j = await getJson("/api/investigations/PSI-25");
  assert(j.id && Array.isArray(j.testRuns), "bad payload");
});
await check("GET /api/investigations/{id}/runs", async () => {
  const j = await getJson("/api/investigations/PSI-25/runs?limit=3");
  assert(j.total > 0 && j.runs.length > 0, "bad payload");
});
await check("GET /api/tests", async () => assert((await getJson("/api/tests?fuel=PMMA&limit=3")).total > 0, "no rows"));
await check("GET /api/row", async () => {
  const j0 = await getJson("/api/investigations?limit=1");
  const j = await getJson(`/api/row?row_uid=${encodeURIComponent(j0.rows[0].row_uid)}`);
  assert(j.row && j.row.row_uid === j0.rows[0].row_uid, "row not found");
});
await check("GET /api/habitats", async () => assert((await getJson("/api/habitats")).habitats.length === 5, "expected 5 habitats"));
await check("GET /api/rank?habitat=moon", async () => {
  const j = await getJson("/api/rank?habitat=moon&top=5");
  assert(j.habitat === "moon" && j.ranked.length === 5 && j.by_investigation.length > 0, "bad payload");
  return `top: ${j.by_investigation[0].psi_id}`;
});
await check("GET /api/rank/all", async () => assert(Object.keys((await getJson("/api/rank/all?top=3")).habitats).length === 5, "expected 5 habitats"));
await check("POST /api/rank-habitat", async () => assert((await postJson("/api/rank-habitat", { habitat: "mars", top: 3 })).ranked.length === 3, "bad payload"));
await check("GET /api/effective-gravity", async () => assert((await getJson("/api/effective-gravity")).regimes.length === 4, "expected 4 regimes"));
await check("POST /api/predict/flammability", async () => {
  const j = await postJson("/api/predict/flammability", { gravity_g: 0.16, pressure_kpa: 70.3, o2_pct: 30, flow_velocity_cm_s: 15, fuel: "Methanol", droplet_diameter_mm: 3, n_initial_mole_frac: 0.7, co_initial_mole_frac_as_labeled: 0, he_mole_pct: 0 });
  assert(typeof j.prediction.limiting_o2_index_pct === "number" && Array.isArray(j.prediction.empirical), "bad payload");
  return `mode ${j.model_mode}`;
});
await check("POST /api/predict-flammability", async () => assert(typeof (await postJson("/api/predict-flammability", {})).prediction.ventilation_hazard === "number", "bad payload"));
await check("GET /api/predict/grid", async () => assert((await getJson("/api/predict/grid?gravity=0.38&o2_steps=4&flow_steps=3")).cells.length === 12, "expected 12 cells"));
await check("POST /api/predict/smoke-dust", async () => {
  const j = await postJson("/api/predict/smoke-dust", { sample_material: "Kapton", inlet_velocity_cm_s: 5, net_aging_time_s: 60 });
  assert(j.available && j.samer_psi101 && j.same_psi102, "bad payload");
  return `mode ${j.mode}`;
});
await check("POST /api/classify-aerosol", async () => assert((await postJson("/api/classify-aerosol", { sample_material: "Silicone" })).available, "bad payload"));
await check("GET /api/smoke-dust/examples", async () => assert((await getJson("/api/smoke-dust/examples?limit=5")).samer_psi101_rows.length === 5, "bad payload"));
await check("GET /api/model-metrics", async () => assert((await getJson("/api/model-metrics")).candidates.length > 0, "bad payload"));
await check("GET /api/model-audit", async () => assert((await getJson("/api/model-audit?candidate=same_r_rt_r0")).candidates.length === 1, "bad payload"));
await check("GET /api/variable-summary", async () => assert((await getJson("/api/variable-summary?psi_id=PSI-159")).n_columns > 0, "bad payload"));
await check("GET /api/conversions", async () => assert((await getJson("/api/conversions")).n > 0, "bad payload"));
await check("GET /api/provenance", async () => assert((await getJson("/api/provenance")).rows > 0, "bad payload"));
for (const route of ["/api/ingest-psi", "/api/upload"]) {
  await check(`POST ${route} (CSV)`, async () => {
    const form = new FormData();
    form.append("file", new Blob(["Test ID,Fuel,Ambient Pressure (atm),O2 (% by volume),Air Flow (cm/s)\nA1,PMMA rod,0.68,30,10\n"], { type: "text/csv" }), "PSI-999_upload.csv");
    const res = await fetch(base + route, { method: "POST", body: form });
    assert(res.status === 200, `HTTP ${res.status}`);
    const j = await res.json();
    assert(j.n_rows === 1 && j.persisted === false && typeof j.rows[0].score_moon === "number", "bad payload");
    return `best habitat ${j.rows[0].best_habitat}`;
  });
}
await check("POST /api/assistant (works without an OpenAI key)", async () => {
  const j = await postJson("/api/assistant", { question: "What did PSI-159 measure?" });
  assert(typeof j.answer === "string" && j.answer.length > 20, "empty answer");
  return `mode ${j.mode}`;
});

console.log(failed ? `\n${failed} check(s) FAILED against ${base}` : `\nAll checks passed against ${base}`);
process.exit(failed ? 1 : 0);
