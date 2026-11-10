"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

interface CosmicTransitionContextType {
  triggerTransition: (href: string, direction: "forward" | "reverse") => void;
}

const CosmicTransitionContext = createContext<CosmicTransitionContextType>({
  triggerTransition: () => {},
});

export function useCosmicTransition() {
  return useContext(CosmicTransitionContext);
}

export function CosmicTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTransitionClasses = useCallback(() => {
    document.body.classList.remove("cosmic-warp-forward", "cosmic-warp-reverse");
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
  }, []);

  const triggerTransition = useCallback((href: string, dir: "forward" | "reverse") => {
    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    const className = dir === "forward" ? "cosmic-warp-forward" : "cosmic-warp-reverse";
    document.body.classList.add(className);

    // Snappy warp duration (260ms) before router dispatch
    setTimeout(() => {
      router.push(href);
    }, 260);

    // Safety fallback: clear classes after 650ms max
    if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    cleanupTimeoutRef.current = setTimeout(() => {
      document.body.classList.remove("cosmic-warp-forward", "cosmic-warp-reverse");
    }, 650);
  }, [router]);

  // Intercept delegated clicks for smooth seamless transitions
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      const targetAttr = target.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;

      const currentPath = window.location.pathname;

      // Navigating Homepage -> Explore
      if (currentPath === "/" && (href === "/explore" || href.startsWith("/explore?"))) {
        e.preventDefault();
        triggerTransition(href, "forward");
        return;
      }

      // Navigating Explore -> Homepage
      if (
        (currentPath.startsWith("/explore") || currentPath.startsWith("/investigations")) &&
        (href === "/" || href.startsWith("/#"))
      ) {
        e.preventDefault();
        triggerTransition(href, "reverse");
        return;
      }
    };

    const handlePopState = () => {
      clearTransitionClasses();
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    };
  }, [triggerTransition, clearTransitionClasses]);

  // Handle route change reveal
  useEffect(() => {
    clearTransitionClasses();

    // Trigger reveal cascade on Explore
    if (pathname.startsWith("/explore")) {
      const mainEl = document.querySelector(".explore-main-stage");
      if (mainEl) {
        mainEl.classList.remove("cosmic-reveal-stage");
        // Force reflow
        void (mainEl as HTMLElement).offsetWidth;
        mainEl.classList.add("cosmic-reveal-stage");
      }
    }
  }, [pathname, clearTransitionClasses]);

  return (
    <CosmicTransitionContext.Provider value={{ triggerTransition }}>
      {children}
      {/* Cinematic Transition Portal / Optical Vignette Overlay */}
      <div className="cosmic-transit-overlay pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true" />
    </CosmicTransitionContext.Provider>
  );
}
