import type { Metadata } from "next";
import { QuickLinks, StateScreen } from "@/components/ui/state-screen";

export const metadata: Metadata = { title: "Page not found | OrbitFlame" };

export default function NotFound() {
  return (
    <StateScreen code="404" title="This page is not in the index" actions={<QuickLinks />}>
      <p>The investigation or page you opened does not exist. Investigation IDs look like PSI-69; browse the explorer to find the one you need.</p>
    </StateScreen>
  );
}
