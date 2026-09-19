"use client";
import { useEffect } from "react";
import { formatNumber } from "@/lib/format";
import { useTranslations } from "next-intl";

// Grouped bar chart (Entrées vs Sorties) rendered as pure SVG — no deps.
export function BarChart({ data, height = 240 }) {
  const width = 620;
  const padR = 12;
  const padT = 16;
  const padB = 34;

  const max = Math.max(
    1,
    ...data.flatMap((d) => [d.received || 0, d.distributed || 0]),
  );
  // round max up to a nice value
  const niceMax = niceCeil(max);

  // The Y axis labels are computed BEFORE the layout so the left gutter can be
  // sized on the longest one. It used to be a fixed 44px: with large amounts
  // the labels were wider than the gutter and the SVG viewBox cut their first
  // characters off ("0000M" instead of "10000M").
  const ticks = 4;
  const AXIS_FONT = 10;
  const tickValues = Array.from(
    { length: ticks + 1 },
    (_, i) => (niceMax / ticks) * i,
  );
  const tickLabels = tickValues.map(shortNum);
  const longestLabel = tickLabels.reduce((m, l) => Math.max(m, l.length), 0);
  const padL = Math.max(44, Math.ceil(longestLabel * AXIS_FONT * 0.62) + 16);

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const groups = data.length || 1;
  const groupW = innerW / groups;
  const barW = Math.min(18, groupW / 3.2);
  const gap = 6;

  const yFor = (v) => padT + innerH - (v / niceMax) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img">
      {tickValues.map((v, i) => {
        const y = yFor(v);
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.7"
            />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={AXIS_FONT}
              fill="var(--muted-2)"
            >
              {tickLabels[i]}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = padL + groupW * i + groupW / 2;
        const x1 = gx - barW - gap / 2;
        const x2 = gx + gap / 2;
        const hr = ((d.received || 0) / niceMax) * innerH;
        const hd = ((d.distributed || 0) / niceMax) * innerH;
        return (
          <g key={i}>
            <rect
              x={x1}
              y={yFor(d.received || 0)}
              width={barW}
              height={Math.max(0, hr)}
              rx="4"
              fill="#52b788"
            >
              <title>{`Entr\u00e9es: ${formatNumber(d.received || 0)} DA`}</title>
            </rect>
            <rect
              x={x2}
              y={yFor(d.distributed || 0)}
              width={barW}
              height={Math.max(0, hd)}
              rx="4"
              fill="#e9806a"
            >
              <title>{`Sorties: ${formatNumber(d.distributed || 0)} DA`}</title>
            </rect>
            <text
              x={gx}
              y={height - 12}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut chart with a center label. segments: [{ label, value, color }]
export function DonutChart({
  segments,
  size = 180,
  thickness = 30,
  centerTop,
  centerSub,
}) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--raised)"
        strokeWidth={thickness}
      />
      {segments.map((seg, i) => {
        const frac = (seg.value || 0) / total;
        const len = frac * circ;
        const el = (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${c} ${c})`}
            strokeLinecap="butt"
          >
            <title>{`${seg.label}: ${Math.round(frac * 100)}%`}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
      {centerTop != null && (
        <text
          x={c}
          y={c - 2}
          textAnchor="middle"
          fontSize="22"
          fontWeight="800"
          fill="var(--text)"
        >
          {centerTop}
        </text>
      )}
      {centerSub != null && (
        <text
          x={c}
          y={c + 16}
          textAnchor="middle"
          fontSize="11"
          fill="var(--muted)"
        >
          {centerSub}
        </text>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * ClickableChart: wraps any chart so clicking it opens an interactive popup.
 * ChartModal: the enlarged popup with the chart, a legend and a description.
 * ------------------------------------------------------------------------- */
export function ClickableChart({ children, onOpen }) {
  const t = useTranslations("App");
  return (
    <div
      className="chart-clickable"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
      <span className="chart-hint">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
        {t("Cliquez pour agrandir")}
      </span>
    </div>
  );
}

export function ChartModal({ title, description, legend, onClose, children }) {
  const t = useTranslations("App");
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal modal-chart" role="dialog" aria-modal="true">
        <div className="modal-accent" />
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label={t("Fermer")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="chart-modal-canvas">{children}</div>
          {legend && legend.length > 0 && (
            <div className="chart-modal-legend">
              {legend.map((l) => (
                <div className="legend-row" key={l.label}>
                  <span className="dot" style={{ background: l.color }} />
                  {l.label}
                  {l.value != null && <span className="lg-val">{l.value}</span>}
                </div>
              ))}
            </div>
          )}
          {description && (
            <div className="chart-modal-desc">
              <div className="chart-modal-desc-title">
                {t("\u00c0 propos de ce graphique")}
              </div>
              <p>{description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function niceCeil(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

// Compact axis labels: 0 / 12 k / 750 M / 1,5 Md.
// The previous version stopped at "M", so a balance in the billions produced
// labels like "10000M" that no longer fitted in the axis gutter. Above a
// billion the unit now becomes "Md", which keeps every label short.
function shortNum(v) {
  const fmt = (n) => {
    const r = Math.round(n * 10) / 10;
    return (Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)).replace(
      ".",
      ",",
    );
  };
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${fmt(v / 1_000_000_000)} Md`;
  if (abs >= 1_000_000) return `${fmt(v / 1_000_000)} M`;
  if (abs >= 1_000) return `${fmt(v / 1_000)} k`;
  return String(Math.round(v));
}
