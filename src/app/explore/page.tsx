import { ExplorerView } from "@/components/explorer/explorer-view";
import { listSummaries } from "@/lib/data/repository";
import { digestOf, varsFor, type VarDigest } from "@/lib/data/variables";
import { loadVariableSummaryServer } from "@/lib/data/variables-server";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const [records, params, vars] = await Promise.all([listSummaries(), searchParams, loadVariableSummaryServer().catch(() => null)]);
  const digests: Record<string, VarDigest> = {};
  for (const r of records) if (vars) digests[r.id] = digestOf(varsFor(vars.data, r.id));
  return <ExplorerView records={records} initialFamily={params.family ?? ""} digests={digests} />;
}
