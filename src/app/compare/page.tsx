import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";
import { listSummaries } from "@/lib/data/repository";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const [records, params] = await Promise.all([listSummaries(), searchParams]);
  return (
    <Suspense>
      <CompareView records={records} initialIdsParam={params.ids ?? null} />
    </Suspense>
  );
}
