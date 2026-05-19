"use client";

import { useEffect, useId, useState } from "react";
import { MONTH_KEYS } from "../lib/constants";
import { nearestIdx } from "../lib/gridUtils";
import Flag from "./Flag";
import ComparePanel from "./ComparePanel";

/* ─── Formatters ─────────────────────────────────────────────────── */
function fmtPrice(v) { return v != null ? `€${Math.round(v)}` : null; }
function fmtTemp(v) { return v != null ? `${v.toFixed(1)}°C` : null; }
function fmtPct(v) { return v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : null; }
function fmtNum(v, dec = 1) { return v != null ? v.toFixed(dec) : null; }
function fmtSigned(v, dec, unit) {
  if (v == null) return null;
  return `${v > 0 ? "+" : ""}${v.toFixed(dec)}${unit}`;
}

/* ─── Risk tier visual mapping ───────────────────────────────────── */
const RISK = {
  "Low Risk":      { ring: "#10b981", text: "text-emerald-700", bg: "bg-emerald-50/80", ringCls: "ring-emerald-200/70" },
  "Moderate Risk": { ring: "#f59e0b", text: "text-amber-700",   bg: "bg-amber-50/80",   ringCls: "ring-amber-200/70" },
  "High Risk":     { ring: "#f97316", text: "text-orange-700",  bg: "bg-orange-50/80",  ringCls: "ring-orange-200/70" },
  "Critical":      { ring: "#e11d48", text: "text-rose-700",    bg: "bg-rose-50/80",    ringCls: "ring-rose-200/70" },
};
const RISK_DEFAULT = { ring: "#94a3b8", text: "text-slate-600", bg: "bg-slate-50/80", ringCls: "ring-slate-200/70" };

/* ─── Building blocks ────────────────────────────────────────────── */
function Stat({ label, value, accent }) {
  const missing = value == null;
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-slate-900/[0.06] last:border-b-0">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span
        className={`font-mono text-[12px] tabular-nums ${
          missing ? "text-slate-300" : (accent || "text-slate-900")
        }`}
      >
        {missing ? "N/A" : value}
      </span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="h-px w-3 bg-slate-900/30" />
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate-500">{children}</p>
    </div>
  );
}

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/* ─── Sparkline ───────────────────────────────────────────────────── */
function Sparkline({ data, loading }) {
  const uid = useId();
  const gradientId = `spark-fill-${uid}`;
  const w = 280, h = 56, pad = 6;
  if (loading || !data) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
        <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#e2e8f0" strokeWidth="1.4" strokeDasharray="4 3" />
      </svg>
    );
  }
  const points = data;
  const min = points.reduce((a, b) => Math.min(a, b));
  const max = points.reduce((a, b) => Math.max(a, b));
  const range = max - min || 1;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - 2 * pad));
  const ys = points.map((p) => h - pad - ((p - min) / range) * (h - 2 * pad));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L ${xs[xs.length - 1]} ${h - pad} L ${xs[0]} ${h - pad} Z`;
  const peakIdx = points.indexOf(max);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs[peakIdx]} cy={ys[peakIdx]} r="2.4" fill="#fff" stroke="#f59e0b" strokeWidth="1.4" />
      </svg>
      <div className="flex justify-between mt-0.5">
        {MONTH_INITIALS.map((m, i) => (
          <span key={i} className="font-mono text-[8px] text-slate-300 w-[1ch] text-center">{m}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Circular gauge for resilience score ────────────────────────── */
function RingGauge({ score, color }) {
  const size = 200, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-44 h-44">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      <text
        x={size / 2} y={size / 2 + 4} textAnchor="middle"
        className="fill-slate-900"
        style={{ fontFamily: "var(--font-instrument-serif), serif", fontStyle: "italic", fontSize: 56 }}
      >
        {Math.round(score)}
      </text>
      <text
        x={size / 2} y={size / 2 + 28} textAnchor="middle"
        className="fill-slate-400"
        style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 9, letterSpacing: "0.22em" }}
      >
        / 100
      </text>
    </svg>
  );
}

/* ─── Climate data cache (module-level, persists for the session) ─── */
const climateCache = {};

async function fetchSparklineTemps(lat, lon) {
  const months = await Promise.all(
    MONTH_KEYS.map((key) => {
      if (!climateCache[key]) {
        climateCache[key] = fetch(`/data/climate_normals/climate_${key}.json`)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status} loading climate_${key}.json`);
            return res.json();
          });
      }
      return climateCache[key];
    })
  );
  const { lats, lons } = months[0];
  const latIdx = nearestIdx(lats, lat);
  const lonIdx = nearestIdx(lons, lon);
  return months.map((m) => m.temperature[latIdx]?.[lonIdx] ?? null);
}

/* ─── Tabs definition ────────────────────────────────────────────── */
const TABS = [
  { key: "climate", label: "Climate" },
  { key: "cost", label: "Cost" },
  { key: "resilience", label: "Resilience" },
];

/* ─── Component ──────────────────────────────────────────────────── */
export default function CityDetailPanel({ city, onClose, compareCities = [], onToggleCompare, onCitySelect, climateData, month }) {
  const [tab, setTab] = useState("climate");
  const [sparklineTemps, setSparklineTemps] = useState(null);
  const [sparklineLoading, setSparklineLoading] = useState(false);

  useEffect(() => {
    if (!city?.lat || !city?.lon) return;
    setSparklineTemps(null);
    setSparklineLoading(true);
    fetchSparklineTemps(city.lat, city.lon)
      .then(setSparklineTemps)
      .catch(() => setSparklineTemps(null))
      .finally(() => setSparklineLoading(false));
  }, [city?.lat, city?.lon]);

  if (!city) return null;

  const risk = RISK[city.risk_tier] || RISK_DEFAULT;
  const isPinned = compareCities.some((c) => c.city === city.city && c.country === city.country);
  const showCompare = compareCities.length === 2;

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-[60] h-[72%] rounded-t-2xl border-t border-slate-900/10 shadow-[0_-8px_48px_rgba(15,23,42,0.12)] city-panel-slide-in sm:absolute sm:top-0 sm:right-0 sm:left-auto sm:bottom-auto sm:w-[380px] sm:h-full sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-[0_0_60px_rgba(15,23,42,0.15)] sm:[animation:none] bg-white/92 backdrop-blur-xl overflow-hidden flex flex-col font-sans">
      {/* Hairline amber accent — mirrors the filter board */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent z-10" />

      {/* Mobile: drag handle + compare/close buttons inline (hidden on desktop) */}
      <div className="sm:hidden flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={() => onToggleCompare?.(city)}
          aria-label={isPinned ? "Remove from comparison" : "Add to comparison"}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] transition-all ${
            isPinned
              ? "bg-amber-500 text-white shadow-sm"
              : "ring-1 ring-slate-900/20 text-slate-500 hover:ring-amber-500/60 hover:text-amber-600"
          }`}
        >
          {isPinned ? "Pinned ✓" : "+ Compare"}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-slate-300" />
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors text-base"
        >
          ✕
        </button>
      </div>

      {/* Desktop: compare toggle (absolute, hidden on mobile) */}
      <button
        onClick={() => onToggleCompare?.(city)}
        aria-label={isPinned ? "Remove from comparison" : "Add to comparison"}
        className={`hidden sm:flex absolute top-4 right-14 z-20 items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] transition-all ${
          isPinned
            ? "bg-amber-500 text-white shadow-sm"
            : "ring-1 ring-slate-900/20 text-slate-500 hover:ring-amber-500/60 hover:text-amber-600"
        }`}
      >
        {isPinned ? "Pinned ✓" : "+ Compare"}
      </button>

      {/* Desktop: close button (absolute, hidden on mobile) */}
      <button
        onClick={onClose}
        aria-label="Close panel"
        className="hidden sm:flex absolute top-4 right-4 w-8 h-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors z-20 text-base"
      >
        ✕
      </button>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 sm:pt-6 pb-5 border-b border-slate-900/10">
        <div className="flex items-center gap-2 mb-2">
          <Flag country={city.country} size="w40" alt={city.country} className="h-3.5 w-auto rounded-sm object-cover" />
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-500">
            {city.country?.trim()}
          </p>
        </div>
        <h2 className="font-serif italic text-[34px] leading-[1.02] text-slate-900 pr-8">
          {city.city}
        </h2>
        {(city.lat != null && city.lon != null) && (
          <div className="mt-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 tabular-nums">
            <span>{city.lat.toFixed(2)}°N</span>
            <span className="text-slate-300">/</span>
            <span>{city.lon.toFixed(2)}°E</span>
          </div>
        )}
        {city.risk_tier && (
          <div className="mt-3 flex items-center gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate-400">
              Climate Risk
            </p>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ring-1 ${risk.bg} ${risk.text} ${risk.ringCls}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: risk.ring }} />
              {city.risk_tier}
            </div>
          </div>
        )}
      </div>

      {showCompare ? (
        /* ── Compare view ──────────────────────────────────────────── */
        <ComparePanel
          cities={compareCities}
          onRemove={(c) => onToggleCompare?.(c)}
          onCityClick={(c) => onCitySelect?.(c)}
          climateData={climateData}
          month={month}
        />
      ) : (
        <>
          {/* ── Tabs ─────────────────────────────────────────────────── */}
          <div className="flex border-b border-slate-900/10 bg-white/40">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex-1 py-3 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                  tab === t.key ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {t.label}
                <span
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-amber-500 transition-all duration-300 ${
                    tab === t.key ? "w-10 opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* ── Tab content ──────────────────────────────────────────── */}
          <div key={tab} className="flex-1 overflow-y-auto px-6 py-5 panel-tab-fade">
            {tab === "climate" && <ClimateTab city={city} sparklineTemps={sparklineTemps} sparklineLoading={sparklineLoading} />}
            {tab === "cost" && <CostTab city={city} />}
            {tab === "resilience" && <ResilienceTab city={city} risk={risk} />}
          </div>
        </>
      )}
    </aside>
  );
}

/* ─── Climate tab ────────────────────────────────────────────────── */
function ClimateTab({ city, sparklineTemps, sparklineLoading }) {
  const baseT = fmtTemp(city.baseline_temp_c);
  const futT = fmtTemp(city.future_temp_c);
  const dT = city.delta_temp_c;
  return (
    <div className="space-y-6">
      {/* Hero: projected warming */}
      <div className="bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-rose-50/40 rounded-xl p-4 ring-1 ring-amber-900/[0.06]">
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-amber-700/90 mb-2">
          Projected Warming
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-serif italic text-[44px] leading-none text-slate-900 tabular-nums">
            {dT != null ? `${dT > 0 ? "+" : ""}${dT.toFixed(1)}` : "—"}
          </span>
          <span className="font-mono text-[11px] text-slate-500 tracking-wide">°C by 2050</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 font-mono text-[10px] tabular-nums text-slate-600">
          <span>{baseT || "—"}</span>
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 8" fill="none">
            <path d="M1 4 L11 4 M8 1 L11 4 L8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-slate-900 font-medium">{futT || "—"}</span>
        </div>
      </div>

      {/* Sparkline */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>Annual Cycle (baseline)</SectionLabel>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Jan — Dec</p>
        </div>
        <Sparkline data={sparklineTemps} loading={sparklineLoading} />
      </div>

      {/* Detailed projections */}
      <div>
        <SectionLabel>Projection Details</SectionLabel>
        <Stat
          label="Summer Temp Δ"
          value={fmtSigned(city.delta_summer_temp_c, 1, "°C")}
          accent={
            city.delta_summer_temp_c == null ? null :
            city.delta_summer_temp_c >= 0 ? "text-rose-700" : "text-blue-700"
          }
        />
        <Stat
          label="Precipitation Δ"
          value={fmtPct(city.delta_precip_pct)}
          accent={city.delta_precip_pct == null ? null : "text-amber-700"}
        />
        <Stat
          label="Extreme Heat Days"
          value={
            city.baseline_heat_days != null && city.future_heat_days != null
              ? `${Math.round(city.baseline_heat_days)} → ${Math.round(city.future_heat_days)}`
              : null
          }
        />
        <Stat
          label="Heat Days Δ"
          value={fmtSigned(city.delta_heat_days, 0, " days")}
          accent={
            city.delta_heat_days == null ? null :
            city.delta_heat_days >= 0 ? "text-rose-700" : "text-blue-700"
          }
        />
      </div>
    </div>
  );
}

/* ─── Cost tab ───────────────────────────────────────────────────── */
function CostTab({ city }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Housing &amp; Lifestyle</SectionLabel>
        <Stat label="Cost-of-Living Index" value={fmtNum(city["cost-of-living-index"])} />
        <Stat label="1-Bed Rent (city)"     value={fmtPrice(city["one-bedroom-city-rent"])} />
        <Stat label="3-Bed Rent (city)"     value={fmtPrice(city["three-bedroom-city-rent"])} />
        <Stat label="Restaurant Meal"       value={fmtPrice(city["meal-restaurant"])} />
        <Stat label="Transport Pass"        value={fmtPrice(city["monthly-public-transport-pass"])} />
        <Stat label="Utilities (85 m²)"     value={fmtPrice(city["basic-utilities-85m2-apartment"])} />
        <Stat label="Cinema Ticket"         value={fmtPrice(city["cinema-ticket"])} />
        <Stat label="Price / m² (buy)"      value={fmtPrice(city["price-square-meter-buy"])} />
      </div>
      <div>
        <SectionLabel>Groceries</SectionLabel>
        <Stat label="Milk (1 L)"      value={fmtPrice(city["1l-milk"])} />
        <Stat label="Chicken (1 kg)"  value={fmtPrice(city["chicken"])} />
        <Stat label="Bread (500 g)"   value={fmtPrice(city["bread"])} />
        <Stat label="Rice (1 kg)"     value={fmtPrice(city["rice"])} />
      </div>
    </div>
  );
}

/* ─── Resilience tab ─────────────────────────────────────────────── */
function ResilienceTab({ city, risk }) {
  if (city.resilience_score == null) {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
          No resilience data
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center">
        <RingGauge score={city.resilience_score} color={risk.ring} />
        {city.risk_tier && (
          <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.24em] ${risk.text}`}>
            {city.risk_tier}
          </p>
        )}
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-slate-600 text-center max-w-[290px]">
        Combines projected temperature trajectory, precipitation shift, and
        heat-day frequency into a single 0–100 measure of mid-century climate
        exposure. Higher scores indicate stronger resilience.
      </p>

      <div className="w-full mt-6 pt-4 border-t border-slate-900/10">
        <Stat label="Resilience Score" value={`${Math.round(city.resilience_score)} / 100`} />
        <Stat label="Risk Tier" value={city.risk_tier} />
      </div>
    </div>
  );
}
