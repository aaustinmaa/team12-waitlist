// A short guided tour: it dims the page, lights up one part at a time and
// explains it. Parts are marked in the page with data-tour="name". A step
// whose part isn't on the page (for example the estimate on a booked referral)
// is left out.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btn } from "./ui";

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

type Box = { top: number; left: number; width: number; height: number };

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
  // Positions are in page coordinates, not screen coordinates, so the
  // highlight and the explanation scroll with the page like any other content
  // instead of being moved after each scroll event (which always lags a frame).
  const [layout, setLayout] = useState<{ box: Box; pop: { top: number; left: number } } | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const step = available[index];
  const last = index === available.length - 1;

  /** Work out where everything goes for this step; with `scroll`, also bring the part into view. */
  const place = useCallback(
    (scroll: boolean) => {
      const el = step ? find(step.target) : null;
      const card = pop.current;
      if (!el || !card) return;
      const r = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const box = { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
      const w = card.offsetWidth;
      const h = card.offsetHeight;

      // Where the page will be scrolled to: tall parts start just under the header, short ones sit a little above the middle.
      const tall = vw < 640 || box.height > vh * 0.55;
      const maxY = Math.max(0, document.documentElement.scrollHeight - vh);
      const wanted = box.top - (tall ? HEADER : Math.max(HEADER, (vh - box.height) / 2 - 80));
      const y = scroll ? Math.min(maxY, Math.max(0, wanted)) : window.scrollY;

      // Under the part if it fits on screen, else above it, else over its lower part at the bottom of the screen.
      let top: number;
      if (box.top + box.height + GAP + h <= y + vh - 8) top = box.top + box.height + GAP;
      else if (box.top - GAP - h >= y + HEADER - 8) top = box.top - GAP - h;
      else top = y + vh - h - GAP;
      const left = window.scrollX + Math.min(Math.max(GAP, r.left + r.width / 2 - w / 2), Math.max(GAP, vw - w - GAP));

      setLayout((prev) =>
        prev &&
        prev.box.top === box.top &&
        prev.box.left === box.left &&
        prev.box.width === box.width &&
        prev.box.height === box.height &&
        prev.pop.top === top &&
        prev.pop.left === left
          ? prev
          : { box, pop: { top, left } },
      );
      if (scroll) {
        window.scrollTo({ top: y, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    },
    [step],
  );

  // Nothing to show (none of the parts are on this page): close straight away.
  useEffect(() => {
    if (available.length === 0) onClose();
  }, [available.length, onClose]);

  // New step: place it and scroll to it.
  useLayoutEffect(() => place(true), [place]);

  // Only a change in layout (window resized, an image or font loading, a card opening) moves things again. Scrolling never does.
  useEffect(() => {
    const el = step ? find(step.target) : null;
    const again = () => place(false);
    const ro = new ResizeObserver(again);
    ro.observe(document.body);
    if (el) ro.observe(el);
    if (pop.current) ro.observe(pop.current);
    window.addEventListener("resize", again);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", again);
    };
  }, [step, place]);

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
  const box = layout?.box;

  return createPortal(
    <div className="print:hidden">
      {/* Catches clicks so the page underneath can't be changed by accident during the tour. */}
      <div className="fixed inset-0 z-50" aria-hidden />
      {box && (
        // The dimming is this box's shadow, wide enough to cover any page, so the lit part and the dim around it move as one.
        <div
          aria-hidden
          className="pointer-events-none absolute z-50 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.62)] outline-2 outline-white/90"
          style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }}
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
        className="absolute z-50 w-[min(22.5rem,calc(100vw-1.5rem))] animate-fade-in rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 sm:p-5"
        style={layout ? { top: layout.pop.top, left: layout.pop.left } : { top: 0, left: 0, visibility: "hidden" }}
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
              className={btn("primary")}
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
