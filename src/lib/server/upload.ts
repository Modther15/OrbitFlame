import { ingestAndScore, DIRECT_LABEL } from "@/lib/engine/ingest";
import { fail, ok, NO_STORE } from "@/lib/server/http";
import { habitatProfiles, sourceInfo } from "@/lib/server/data";

const MAX_BYTES = 10_000_000;

/** Parse an uploaded PSI export (CSV / TSV / ISA-Tab TXT) in memory and score each row against the five habitat profiles. Nothing is stored. */
export async function handleUpload(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(422, [{ loc: ["body", "file"], msg: "expected a multipart/form-data upload with a 'file' field", type: "missing" }]);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(422, [{ loc: ["body", "file"], msg: "field required", type: "missing" }]);
  const name = file.name || "upload";
  if (!/\.(csv|xlsx|xls|txt|tsv)$/i.test(name)) return fail(400, "Supported formats: .csv, .txt / .tsv (ISA-Tab)");
  if (file.size > MAX_BYTES) return fail(413, "File too large (10 MB limit)");
  if (/\.(xlsx|xls)$/i.test(name)) {
    return fail(422, "Excel workbooks are not parsed by the built-in API. Export the sheet as CSV, or connect the optional Python backend (NEXT_PUBLIC_API_BASE).");
  }
  const result = ingestAndScore(await file.text(), name, await habitatProfiles());
  if ("error" in result) return fail(422, result.error);
  return ok(
    {
      ...(await sourceInfo()),
      filename: result.filename,
      n_rows: result.n_rows,
      persisted: false,
      source: DIRECT_LABEL,
      recognised_columns: result.recognised_columns,
      missing_canonical: result.missing_canonical,
      inferred_fields: result.inferred_fields,
      scoring_defaults: ["missing gravity, flow, fuel or pillar values stay null and score as neutral 0.5 similarity; a missing O2 or pressure value scores 0.15 (a row that states no atmosphere cannot be shown to match one); nothing is invented"],
      rows: result.rows,
    },
    NO_STORE,
  );
}
