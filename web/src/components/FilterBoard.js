"use client";

import { MONTH_NAMES } from "../lib/constants";
import { formatMetric } from "../lib/utils";
import { STOP_MAP, GREEN_RED_STOPS, stopsToGradient } from "../lib/colorScales";
import CitySearch from "./CitySearch";
import Flag from "./Flag";

const VARIABLE_SHORT = { temperature: "Temp", precipitation: "Rain", sunshine: "Sun" };

export default function FilterBoard({
  month,
  onMonthChange,
  loading,
  error,
  variable,
  variables,
  onVariableChange,
  bubbleMetric,
  bubbleMetrics,
  onBubbleMetricChange,
  bubbleRange,
  cities,
  onCitySelect,
  onViewCompare,
  compareCities,
  addingCompareSlot,
  onAddingCompareSlotChange,
  onToggleCompare,
  selectedCity,
  filterExpanded,
  onToggleExpanded,
}) {
  const variableKeys = Object.keys(variables);
  const variableIdx = variableKeys.indexOf(variable);
  const currentBubbleMetric = bubbleMetrics[bubbleMetric];
  const { min: bMin, max: bMax } = bubbleRange;
  const { unit } = variables[variable];

  function renderCompareSlot(slotIdx) {
    const city = compareCities[slotIdx];
    if (city) {
      return (
        <div
          key={`pinned-${city.city}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ring-1 ring-slate-900/15 bg-white/60 min-w-0"
        >
          <Flag country={city.country} />
          <span className="font-serif italic text-[13px] text-slate-900 flex-1 truncate leading-tight">
            {city.city}
          </span>
          <button
            onClick={() => onToggleCompare(city)}
            aria-label={`Remove ${city.city} from comparison`}
            className="text-[9px] text-slate-400 hover:text-slate-900 transition-colors leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>
      );
    }
    if (slotIdx > compareCities.length) return null;
    const isActiveSlot = slotIdx === compareCities.length;
    if (isActiveSlot && addingCompareSlot) {
      return (
        <div
          key={`search-${slotIdx}`}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setTimeout(() => onAddingCompareSlotChange(false), 120);
            }
          }}
        >
          <CitySearch
            cities={cities}
            hideLabel
            autoFocus
            placeholder="Add city to compare…"
            excludeCities={compareCities}
            onSelect={(city) => {
              onToggleCompare(city);
              onAddingCompareSlotChange(false);
            }}
          />
        </div>
      );
    }
    return (
      <button
        key={`add-${slotIdx}`}
        onClick={() => onAddingCompareSlotChange(true)}
        disabled={!isActiveSlot}
        className={`w-full px-2.5 py-1.5 rounded-full border border-dashed text-[10px] font-mono uppercase tracking-[0.22em] transition-colors ${
          isActiveSlot
            ? "border-slate-300 text-slate-400 hover:border-amber-500/60 hover:text-amber-600 cursor-pointer"
            : "border-slate-200 text-slate-300 cursor-default"
        }`}
      >
        + Add a city
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[40] h-[84vh] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${filterExpanded ? "translate-y-0" : "translate-y-[calc(100%-72px)]"} sm:absolute sm:bottom-auto sm:top-5 sm:left-5 sm:right-auto sm:w-[300px] sm:h-auto sm:translate-y-0 sm:transition-none bg-white/92 sm:bg-white/85 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl ring-1 ring-slate-900/[0.06] shadow-[0_-8px_32px_rgba(15,23,42,0.08)] sm:shadow-[0_8px_32px_rgba(15,23,42,0.10)] overflow-hidden`}
    >
      {/* Hairline amber accent at the very top — sets the visual identity */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

      {/* Mobile drag handle + tap-to-expand collapsed header */}
      <button
        className="sm:hidden w-full flex flex-col items-center pt-2.5"
        onClick={onToggleExpanded}
        aria-expanded={filterExpanded ? "true" : "false"}
        aria-label={filterExpanded ? "Collapse controls" : "Expand map controls"}
      >
        <div className="w-9 h-1 rounded-full bg-slate-300 mb-2.5" />
        <div className="w-full flex items-center justify-between px-5 pb-3.5 border-b border-slate-900/10">
          <span className="font-serif italic text-[18px] text-slate-900">Controls</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-600/90">
              {MONTH_NAMES[month].slice(0, 3)} · {VARIABLE_SHORT[variable]}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300${filterExpanded ? " rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </button>

      <div className="p-5 overflow-y-auto max-h-[calc(84vh-72px)] sm:max-h-[calc(100vh-2.5rem)]">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400 mb-1.5">
            Climate Observatory
          </p>
          <h1 className="font-serif italic text-[24px] leading-[1.05] text-slate-900">
            European Climate<br />
            <span className="text-slate-500">&amp; Living Costs</span>
          </h1>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="h-px w-6 bg-slate-900/30" />
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate-500">
              Interactive BI Dashboard
            </p>
          </div>
        </div>

        {/* ── Search ─────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-900/10">
          <CitySearch cities={cities} onSelect={onCitySelect} />
        </div>

        {/* ── Month ──────────────────────────────────────────────── */}
        <div className="pt-4 mt-4 border-t border-slate-900/10">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400">
              Month
            </p>
            <button
              disabled
              title="Coming soon"
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 opacity-40 cursor-not-allowed"
            >
              <span className="text-[8px] leading-none">▶</span>
              Play
            </button>
          </div>

          <div className="flex items-baseline justify-between">
            <h2 className="font-serif italic text-[30px] leading-none text-slate-900 tabular-nums">
              {MONTH_NAMES[month]}
            </h2>
            {loading && (
              <span className="inline-block w-3 h-3 border border-slate-900 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Custom slider: invisible native input overlaid on decorated track */}
          <div className="relative h-6 mt-3">
            <input
              type="range"
              min={0}
              max={11}
              value={month}
              onChange={onMonthChange}
              disabled={loading}
              className={`absolute inset-0 w-full h-full opacity-0 z-20 ${loading ? "cursor-not-allowed" : "cursor-pointer"}`}
            />
            {/* base rail */}
            <div className="absolute top-1/2 left-1 right-1 h-px bg-slate-300 -translate-y-1/2" />
            {/* filled progress */}
            <div
              className="absolute top-1/2 left-1 h-px bg-slate-900 -translate-y-1/2 transition-[width]"
              style={{ width: `calc(${(month / 11) * 100}% - ${(month / 11) * 0.5}rem)` }}
            />
            {/* tick marks */}
            <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 flex justify-between">
              {MONTH_NAMES.map((_, i) => (
                <div
                  key={i}
                  className={`w-px h-2 transition-colors ${
                    i === month ? "bg-amber-500" : i < month ? "bg-slate-700" : "bg-slate-300"
                  }`}
                />
              ))}
            </div>
            {/* thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border-[1.5px] border-slate-900 rounded-full shadow-sm transition-[left] duration-150 pointer-events-none"
              style={{ left: `calc(0.25rem + ${(month / 11) * 100}% - ${(month / 11) * 0.5}rem)` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[8px] uppercase tracking-[0.18em] text-slate-400">
            <span>Jan</span>
            <span>Jul</span>
            <span>Dec</span>
          </div>
        </div>

        {/* ── Heatmap Variable ───────────────────────────────────── */}
        <div className="pt-4 mt-4 border-t border-slate-900/10">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400 mb-2">
            Heatmap Variable
          </p>
          {/* Segmented control with sliding indicator */}
          <div className="relative grid grid-cols-3 bg-slate-100 rounded-lg p-0.5">
            <div
              className="absolute top-0.5 bottom-0.5 left-0.5 bg-slate-900 rounded-md shadow-sm transition-transform duration-300 ease-out"
              style={{
                width: `calc((100% - 0.25rem) / 3)`,
                transform: `translateX(${variableIdx * 100}%)`,
              }}
            />
            {variableKeys.map((key) => (
              <button
                key={key}
                onClick={() => onVariableChange(key)}
                className={`relative z-10 py-1.5 text-[11px] font-medium transition-colors ${
                  variable === key ? "text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {variables[key].label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <div
              className="w-full h-1.5 rounded-full ring-1 ring-slate-900/[0.04]"
              style={{ background: stopsToGradient(STOP_MAP[variable]) }}
            />
            <div className="flex justify-between mt-1.5 font-mono text-[9px] tabular-nums text-slate-500">
              <span>{variables[variable].fixedMin} {unit}</span>
              <span>{variables[variable].fixedMax} {unit}</span>
            </div>
          </div>
        </div>

        {/* ── City Bubbles ───────────────────────────────────────── */}
        <div className="pt-4 mt-4 border-t border-slate-900/10">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400 mb-2">
            City Bubbles
          </p>
          <div className="relative">
            <select
              value={bubbleMetric}
              onChange={(e) => onBubbleMetricChange(e.target.value)}
              className="w-full appearance-none px-3 py-2 pr-9 rounded-lg text-[12px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 border-0 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer transition-colors"
            >
              {Object.entries(bubbleMetrics).map(([key, { label: lbl }]) => (
                <option key={key} value={key}>{lbl}</option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none"
              viewBox="0 0 12 12" fill="none"
            >
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {cities && (
            <div className="mt-3">
              <div
                className="w-full h-1.5 rounded-full ring-1 ring-slate-900/[0.04]"
                style={{
                  background: currentBubbleMetric.invert
                    ? stopsToGradient([...GREEN_RED_STOPS].reverse().map((s, i, arr) => ({ ...s, at: i / (arr.length - 1) })))
                    : stopsToGradient(GREEN_RED_STOPS),
                }}
              />
              <div className="flex justify-between mt-1.5 font-mono text-[9px] tabular-nums text-slate-500">
                <span>{formatMetric(bMin, currentBubbleMetric)}</span>
                <span>{formatMetric(bMax, currentBubbleMetric)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 pt-4 border-t border-slate-900/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700 bg-rose-50/80 ring-1 ring-rose-200/60 rounded-md px-2.5 py-2">
              {error}
            </div>
          </div>
        )}

        {/* ── Compare tray (always visible) ──────────────────────── */}
        <div className="pt-4 mt-4 border-t border-slate-900/10">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400 mb-2">
            Comparing
          </p>
          <div className="space-y-1.5">
            {[0, 1].map(renderCompareSlot)}
          </div>
          {compareCities.length === 2 && (
            <button
              onClick={() => onViewCompare(compareCities[0])}
              className="mt-2.5 w-full font-mono text-[9px] uppercase tracking-[0.22em] text-slate-600 hover:text-amber-600 transition-colors py-1.5 text-center"
            >
              View comparison →
            </button>
          )}
        </div>

        {!selectedCity && (
          <div className="pt-4 mt-4 border-t border-slate-900/10 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate-500">
              Click a city bubble for details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
