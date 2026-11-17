// A short guided tour: it dims the page, lights up one part at a time and
// explains it. Parts are marked in the page with data-tour="name". A step
// whose part isn't on the page (for example the estimate on a booked referral)
// is left out.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  /** the data-tour name of the part this step points at */
  target: string;
  title: string;
  body: string;
}

export interface TourLabels {
  next: string;
  back: string;
  skip: string;
  done: string;
  step: (n: number, of: number) => string;
}

export const TOUR_LABELS_EN: TourLabels = {
  next: "Next",
  back: "Back",
  skip: "Skip tour",
  done: "Done",
  step: (n, of) => `Step ${n} of ${of}`,
};

/** Space kept clear under the sticky header when a part is scrolled into view. */
const HEADER = 76;
const GAP = 12;

function find(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)).find((el) => el.getClientRects().length > 0) ?? null;
}

export function Tour({
  steps,
  labels,
  onClose,
  dir = "ltr",
  lang,
}: {
  steps: TourStep[];
  labels: TourLabels;
  onClose: () => void;
  dir?: "ltr" | "rtl";
  lang?: string;
}) {
  const [available] = useState(() => steps.filter((s) => find(s.target)));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const step = available[index];
  const last = index === available.length - 1;

  const measure = useCallback(() => {
    const el = step ? find(step.target) : null;
    setRect((prev) => {
      const next = el ? el.getBoundingClientRect() : null;
      if (prev && next && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height) return prev;
      return next;
    });
  }, [step]);

  // Nothing to show (none of the parts are on this page): close straight away.
  useEffect(() => {
    if (available.length === 0) onClose();
  }, [available.length, onClose]);

  // Bring the part into view, then keep the highlight on it while the page scrolls or resizes.
  useEffect(() => {
    if (!step) return;
    const el = find(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const tall = window.innerWidth < 640 || r.height > vh * 0.55;
    const top = r.top + window.scrollY - (tall ? HEADER : Math.max(HEADER, (vh - r.height) / 2 - 80));
    window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

    measure();
    let raf = 0;
    const until = performance.now() + 800;
    const follow = () => {
      measure();
      if (performance.now() < until) raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [step, measure]);

  // Put the explanation next to the part: under it, above it, or over its lower edge when it fills the screen.
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el || !rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top: number;
    if (rect.bottom + GAP + h <= vh - 8) top = rect.bottom + GAP;
    else if (rect.top - GAP - h >= HEADER - 8) top = rect.top - GAP - h;
    else top = vh - h - GAP;
    const left = Math.min(Math.max(GAP, rect.left + rect.width / 2 - w / 2), Math.max(GAP, vw - w - GAP));
    setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
  }, [rect, index]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;
  const pad = 6;

  return createPortal(
    <div className="print:hidden">
      {/* Catches clicks so the page underneath can't be changed by accident during the tour. */}
      <div className="fixed inset-0 z-50" aria-hidden />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-2xl shadow-[0_0_0_200vmax_rgba(2,6,23,0.62)] outline-2 outline-white/90 transition-[top,left,width,height] duration-150"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div
        ref={pop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        dir={dir}
        lang={lang}
        className="fixed z-50 w-[min(22.5rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 sm:p-5"
        style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: 0 }}
      >
        <p className="text-xs font-medium text-slate-500">{labels.step(index + 1, available.length)}</p>
        <h2 id="tour-title" className="mt-1 text-lg font-semibold text-slate-900">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1 text-sm text-slate-600">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900">
            {labels.skip}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                {labels.back}
              </button>
            )}
            <button
              ref={primary}
              type="button"
              onClick={() => (last ? onClose() : setIndex(index + 1))}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {last ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
