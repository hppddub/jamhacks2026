'use client';

/**
 * Small accessible info tooltip: a focusable "?" icon that reveals an
 * explanatory bubble on hover or keyboard focus. Pure CSS visibility — no JS
 * state — so it works in lists without extra re-renders.
 */
export function InfoTooltip({ label }: { label: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-cream-400/50 text-[9px] font-bold leading-none text-cream-400 transition-colors hover:border-[#ffcc18] hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcc18]"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-lg border border-navy-700 bg-navy-800 px-3 py-2 text-xs font-normal normal-case tracking-normal text-cream-100 opacity-0 shadow-lg shadow-navy-950/40 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
