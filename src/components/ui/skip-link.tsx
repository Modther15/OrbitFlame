"use client";

/** Keyboard skip link: moves focus to the page's <main> landmark. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      onClick={(e) => {
        const main = document.querySelector("main");
        if (!main) return;
        e.preventDefault();
        main.setAttribute("tabindex", "-1");
        (main as HTMLElement).focus();
        main.scrollIntoView();
      }}
      className="fixed top-2 left-2 z-[100] -translate-y-16 rounded-lg bg-[#0d254f] px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-[#52b6ff]"
    >
      Skip to main content
    </a>
  );
}
