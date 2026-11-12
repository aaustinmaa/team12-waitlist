// Small hand-built SVG charts for the Reports page (no chart library).
// Colors follow a colour-blind-checked palette: blue first, orange second.
// Every chart has a hover/keyboard readout and a table view, so no value is
// only reachable by hovering.

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { parseDay } from "../lib/dates";

export const C = {
  blue: "#2a78d6",
  orange: "#eb6834",
  rangeFill: "#b7d3f6",
  band: "#f0efec",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  secondary: "#52514e",
  primary: "#0b0b0b",
  surface: "#ffffff",
};

export interface Series {
  key: string;
  label: string;
  color: string;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Whole-number ticks from 0 with a 1/2/5 step, about four intervals. */
function yTicks(max: number) {
  const rough = Math.max(1, max / 4);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= rough)!;
  const n = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

const MONTH = new Intl.DateTimeFormat("en-CA", { month: "short", timeZone: "UTC" });

export function Legend({ items }: { items: { label: string; color: string; kind: "line" | "area" | "dot" | "range" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.kind === "line" && <span className="h-0.5 w-4 rounded-full" style={{ background: it.color }} />}
          {it.kind === "area" && (
            <span className="h-2.5 w-4 rounded-sm border-t-2" style={{ borderColor: it.color, background: `${it.color}1f` }} />
          )}
          {it.kind === "dot" && <span className="size-2.5 rounded-full" style={{ background: it.color }} />}
          {it.kind === "range" && <span className="h-3.5 w-1.5 rounded-full" style={{ background: it.color }} />}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(160);
  useEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
  });
  const left = x + 12 + w > width ? Math.max(0, x - 12 - w) : x + 12;
  return (
    <div
      ref={ref}
      role="status"
      className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
      style={{ left }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-2 whitespace-nowrap">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="text-slate-500">{label}</span>
    </p>
  );
}

function XAxis({ dates, x, y, plotW }: { dates: string[]; x: (d: string) => number; y: number; plotW: number }) {
  // One tick per month start in range, thinned so labels never collide.
  const first = dates[0];
  const last = dates[dates.length - 1];
  const months: string[] = [];
  let m = first.slice(0, 8) + "01";
  if (m < first) m = nextMonth(m);
  for (; m <= last; m = nextMonth(m)) months.push(m);
  const every = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor(plotW / 44))));
  const shown = months.filter((_, i) => i % every === 0);
  return (
    <g fontSize={11} fill={C.muted}>
      {shown.map((mm, i) => (
        <g key={mm} transform={`translate(${x(mm)},${y})`}>
          <line y1={0} y2={4} stroke={C.axis} />
          <text y={16} textAnchor="middle">
            {MONTH.format(parseDay(mm))}
          </text>
          {(i === 0 || mm.slice(5, 7) === "01" || (every > 1 && shown[i - 1].slice(0, 4) !== mm.slice(0, 4))) && (
            <text y={29} textAnchor="middle">
              {mm.slice(0, 4)}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
}

export interface TimePoint {
  date: string;
  values: Record<string, number | null>;
}

/**
 * Lines over time, or a stacked area (series listed bottom to top).
 * `band` shades the selected quarter.
 */
export function TimeChart({
  points,
  series,
  stacked = false,
  band,
  height = 220,
  format,
  heading,
  label,
  total,
}: {
  points: TimePoint[];
  series: Series[];
  stacked?: boolean;
  band?: { start: string; end: string };
  height?: number;
  format: (n: number) => string;
  heading: (p: TimePoint) => string;
  label: string;
  /** stacked charts: label for the total row in the readout */
  total?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  const m = { top: 12, right: 12, bottom: 36, left: 34 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const t0 = parseDay(points[0].date).getTime();
  const t1 = parseDay(points[points.length - 1].date).getTime();
  const x = (d: string) => m.left + ((parseDay(d).getTime() - t0) / (t1 - t0 || 1)) * plotW;

  const stackTop = (p: TimePoint, upto: number) =>
    series.slice(0, upto + 1).reduce((s, se) => s + (p.values[se.key] ?? 0), 0);
  const maxVal = Math.max(
    ...points.map((p) => (stacked ? stackTop(p, series.length - 1) : Math.max(...series.map((s) => p.values[s.key] ?? 0)))),
  );
  const ticks = yTicks(maxVal);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => m.top + plotH - (v / top) * plotH;

  const pathFor = (key: string, idx: number) => {
    let d = "";
    let pen = false;
    points.forEach((p) => {
      const v = stacked ? stackTop(p, idx) : p.values[key];
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(p.date).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaFor = (idx: number) => {
    const upper = points.map((p) => `${x(p.date).toFixed(1)},${y(stackTop(p, idx)).toFixed(1)}`);
    const lower = points
      .map((p) => `${x(p.date).toFixed(1)},${y(idx === 0 ? 0 : stackTop(p, idx - 1)).toFixed(1)}`)
      .reverse();
    return `M${upper.join("L")}L${lower.join("L")}Z`;
  };

  const nearest = (px: number) => {
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    return best;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const p = active === null ? null : points[active];
  const order = [...series].reverse();

  return (
    <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => setActive(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left))}
          onPointerDown={(e) => setActive(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={() => setActive(null)}
          className="absolute inset-0 touch-pan-y overflow-visible outline-none"
        >
          <title id={titleId}>{`${label}. Use the left and right arrow keys to read values.`}</title>
          {band && (
            <rect
              x={x(band.start < points[0].date ? points[0].date : band.start)}
              y={m.top}
              width={Math.max(0, x(band.end > points[points.length - 1].date ? points[points.length - 1].date : band.end) - x(band.start < points[0].date ? points[0].date : band.start))}
              height={plotH}
              fill={C.band}
            />
          )}
          <g fontSize={11} fill={C.muted}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.axis : C.grid} />
                <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular-nums">
                  {t}
                </text>
              </g>
            ))}
          </g>
          <XAxis dates={points.map((pt) => pt.date)} x={x} y={m.top + plotH} plotW={plotW} />
          {stacked && series.map((s, i) => <path key={`a-${s.key}`} d={areaFor(i)} fill={s.color} fillOpacity={0.1} />)}
          {series.map((s, i) => (
            <path key={s.key} d={pathFor(s.key, i)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {p && (
            <g>
              <line x1={x(p.date)} x2={x(p.date)} y1={m.top} y2={m.top + plotH} stroke={C.muted} />
              {series.map((s, i) => {
                const v = stacked ? stackTop(p, i) : p.values[s.key];
                return v === null || v === undefined ? null : (
                  <circle key={s.key} cx={x(p.date)} cy={y(v)} r={4} fill={s.color} stroke={C.surface} strokeWidth={2} />
                );
              })}
            </g>
          )}
        </svg>
      )}
      {p && (
        <Tooltip x={x(p.date)} width={width}>
          <p className="font-medium text-slate-700">{heading(p)}</p>
          {order.map((s) => {
            const v = p.values[s.key];
            return <TipRow key={s.key} color={s.color} value={v === null || v === undefined ? "–" : format(v)} label={s.label} />;
          })}
          {stacked && total && (
            <p className="mt-1 border-t border-slate-100 pt-1 text-slate-500">
              <span className="font-semibold tabular-nums text-slate-900">{format(stackTop(p, series.length - 1))}</span> {total}
            </p>
          )}
        </Tooltip>
      )}
    </div>
  );
}

export interface RangePoint {
  id: string;
  lower: number;
  upper: number;
  actual: number;
  inside: boolean;
}

/** One column per referral: the estimated range as a bar, the actual wait as a dot. */
export function RangeChart({
  points,
  height = 240,
  label,
  describe,
}: {
  points: RangePoint[];
  height?: number;
  label: string;
  describe: (p: RangePoint) => ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  const m = { top: 12, right: 8, bottom: 26, left: 34 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const ticks = yTicks(Math.max(1, ...points.map((p) => Math.max(p.upper, p.actual))));
  const top = ticks[ticks.length - 1];
  const y = (v: number) => m.top + plotH - (v / top) * plotH;
  const bandW = plotW / Math.max(1, points.length);
  const cx = (i: number) => m.left + bandW * (i + 0.5);
  const barW = Math.max(3, Math.min(10, bandW * 0.45));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left - m.left;
    setActive(Math.min(points.length - 1, Math.max(0, Math.floor(px / bandW))));
  };

  const p = active === null ? null : points[active];

  return (
    <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive(0)}
          onBlur={() => setActive(null)}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          className="absolute inset-0 touch-pan-y outline-none"
        >
          <title id={titleId}>{`${label}. Use the left and right arrow keys to read each referral.`}</title>
          <g fontSize={11} fill={C.muted}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.axis : C.grid} />
                <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            <text x={m.left} y={height - 6}>
              Shortest wait
            </text>
            <text x={m.left + plotW} y={height - 6} textAnchor="end">
              Longest wait
            </text>
          </g>
          {p && <rect x={cx(active!) - bandW / 2} y={m.top} width={bandW} height={plotH} fill={C.band} />}
          {points.map((pt, i) => (
            <g key={pt.id}>
              <rect
                x={cx(i) - barW / 2}
                y={y(pt.upper)}
                width={barW}
                height={Math.max(barW, y(pt.lower) - y(pt.upper))}
                rx={barW / 2}
                fill={C.rangeFill}
              />
              <circle cx={cx(i)} cy={y(pt.actual)} r={4.5} fill={pt.inside ? C.blue : C.orange} stroke={C.surface} strokeWidth={2} />
            </g>
          ))}
        </svg>
      )}
      {p && (
        <Tooltip x={cx(active!)} width={width}>
          {describe(p)}
        </Tooltip>
      )}
    </div>
  );
}

/** "Show as table" twin for a chart. */
export function TableView({ header, rows }: { header: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm print:hidden">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">Show as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg ring-1 ring-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              {header.map((h, i) => (
                <th key={h} className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j > 0 ? "text-right tabular-nums" : "whitespace-nowrap"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
