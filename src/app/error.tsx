"use client";

import Link from "next/link";
import { primaryAction, secondaryAction, StateScreen } from "@/components/ui/state-screen";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StateScreen
      code="ERROR"
      title="Something went wrong loading this page"
      actions={
        <>
          <button type="button" onClick={reset} className={primaryAction}>Try again</button>
          <Link href="/" className={secondaryAction}>Overview</Link>
          <Link href="/explore" className={secondaryAction}>Research Explorer</Link>
        </>
      }
    >
      <p>The data service may be restarting. Your compare selection is kept. Try again in a few seconds.</p>
    </StateScreen>
  );
}
