import { ExplorerView } from "@/components/explorer/explorer-view";
import { investigationRepository } from "@/lib/data/repository";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const records = await investigationRepository.list();
  const params = await searchParams;
  return <ExplorerView records={records} initialFamily={params.family ?? ""} />;
}
