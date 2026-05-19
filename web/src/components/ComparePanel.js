"use client";

import { getColor } from "../lib/colorScales";
import { countryToISO } from "../lib/countryFlags";
import { nearestGridValue } from "../lib/gridUtils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const METRICS = [
  {
    label: "Cost of Living",
    sublabel: "Index",
    getValue: (c) => c["cost-of-living-index"],
    invert: false,
    showWinner: true,
    format: (v) => v != null ? v.toFixed(1) : "—",
  },
  {
    label: "1-Bed Rent",
    sublabel: "City centre",
    getValue: (c) => c["one-bedroom-city-rent"],
    invert: false,
    showWinner: true,
    format: (v) => v != null ? `€${Math.round(v)}` : "—",
  },
  {
    label: "Projected Warming",
    sublabel: "Δ °C by 2050",
    getValue: (c) => c.delta_temp_c,
    invert: false,
    showWinner: true,
    format: (v) => v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}°C` : "—",
  },
  {
    label: "Resilience",
    sublabel: "Score / 100",
    getValue: (c) => c.resilience_score,
    invert: true,
    showWinner: true,
    format: (v) => v != null ? `${Math.round(v)}` : "—",
  },
  {
    label: "Temperature",
    sublabel: "°C this month",
    getValue: (c, cd) => nearestGridValue(cd, c.lat, c.lon, "temperature"),
    invert: false,
    showWinner: false,
    climateGroup: true,
    absoluteColor: { variable: "temperature", min: -15, max: 35 },
    format: (v) => v != null ? `${v.toFixed(1)}°C` : "—",
  },
  {
    label: "Precipitation",
    sublabel: "mm this month",
    getValue: (c, cd) => nearestGridValue(cd, c.lat, c.lon, "precipitation"),
    invert: false,
    showWinner: false,
    climateGroup: true,
    absoluteColor: { variable: "precipitation", min: 0, max: 200 },
    format: (v) => v != null ? `${v.toFixed(0)} mm` : "—",
  },
  {
    label: "Sunshine",
    sublabel: "hrs/day this month",
    getValue: (c, cd) => nearestGridValue(cd, c.lat, c.lon, "sunshine"),
    invert: true,
    showWinner: false,
    climateGroup: true,
    absoluteColor: { variable: "sunshine", min: 0, max: 14 },
    format: (v) => v != null ? `${v.toFixed(1)} h` : "—",
  },
];

const firstClimateIdx = METRICS.findIndex((m) => m.climateGroup);

const EMERALD_500 = "rgb(16, 185, 129)";
const SLATE_300 = "rgb(203, 213, 225)";

function barProps(value, otherValue, invert, showWinner, absoluteColor) {
  const va = value ?? 0;
  const vb = otherValue ?? 0;
  const max = Math.max(va, vb);
  const pct = max === 0 ? 50 : Math.max(6, (va / max) * 100);

  // Climate metrics: color from the heatmap scale (absolute value).
  if (absoluteColor && value != null) {
    const [r, g, b] = getColor(absoluteColor.variable, value, absoluteColor.min, absoluteColor.max);
    return { color: `rgb(${r},${g},${b})`, pct };
  }

  // Cost/resilience: emerald for winner, slate otherwise.
  let isWinner = false;
  if (showWinner && value != null && otherValue != null && va !== vb) {
    isWinner = invert ? va > vb : va < vb;
  }
  return { color: isWinner ? EMERALD_500 : SLATE_300, pct };
}

function Flag({ country }) {
  const iso = countryToISO(country?.trim());
  if (!iso) return null;
  return (
    <img
      src={`https://flagcdn.com/w20/${iso}.webp`}
      alt=""
      className="h-3 w-auto rounded-[1px] flex-shrink-0 ring-1 ring-slate-900/[0.04]"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}

function MetricSection({ metric, cityA, cityB, climateData }) {
  const va = metric.getValue(cityA, climateData);
  const vb = metric.getValue(cityB, climateData);
  const a = barProps(va, vb, metric.invert, metric.showWinner, metric.absoluteColor);
  const b = barProps(vb, va, metric.invert, metric.showWinner, metric.absoluteColor);

  return (
    <div className="mb-5">
      {/* Centered metric label between two hairline rules */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-px flex-1 bg-slate-900/[0.07]" />
        <div className="text-center">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.28em] text-slate-500 leading-none">
            {metric.label}
          </p>
          <p className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-slate-300 mt-0.5 leading-none">
            {metric.sublabel}
          </p>
        </div>
        <span className="h-px flex-1 bg-slate-900/[0.07]" />
      </div>

      <CityBarRow city={cityA} bar={a} formatted={metric.format(va)} />
      <CityBarRow city={cityB} bar={b} formatted={metric.format(vb)} />
    </div>
  );
}

function CityBarRow({ city, bar, formatted }) {
  return (
    <div className="flex items-start gap-2 mb-2 last:mb-0">
      <div className="flex items-center gap-1.5 w-[110px] flex-shrink-0 pt-0.5">
        <Flag country={city.country} />
        <span className="font-serif italic text-[13px] leading-tight text-slate-900 truncate">
          {city.city}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width,background-color] duration-500 ease-out"
            style={{ width: `${bar.pct}%`, backgroundColor: bar.color }}
          />
        </div>
      </div>

      <div className="w-[52px] flex-shrink-0 text-right">
        <span className="font-mono text-[11px] tabular-nums text-slate-900">
          {formatted}
        </span>
      </div>
    </div>
  );
}

export default function ComparePanel({ cities, onRemove, onCityClick, climateData, month = 0 }) {
  const [cityA, cityB] = cities;
  const monthName = MONTH_NAMES[month];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* "VS" header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="text-center">
            <Flag country={cityA.country} />
            <p className="font-serif italic text-[16px] text-slate-900 mt-1 leading-tight">
              {cityA.city}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="h-px w-5 bg-slate-300" />
            <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-slate-400">vs</span>
            <span className="h-px w-5 bg-slate-300" />
          </div>
          <div className="text-center">
            <Flag country={cityB.country} />
            <p className="font-serif italic text-[16px] text-slate-900 mt-1 leading-tight">
              {cityB.city}
            </p>
          </div>
        </div>

        {METRICS.map((m, idx) => (
          <div key={m.label}>
            {idx === firstClimateIdx && (
              <div className="mb-4 mt-2 flex items-center gap-2.5">
                <span className="h-px flex-1 bg-amber-500/25" />
                <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-amber-700/60">
                  {monthName} Climate
                </p>
                <span className="h-px flex-1 bg-amber-500/25" />
              </div>
            )}
            <MetricSection metric={m} cityA={cityA} cityB={cityB} climateData={climateData} />
          </div>
        ))}
      </div>

      {/* Sticky footer — city chips to navigate back or unpin */}
      <div className="px-6 py-4 border-t border-slate-900/10 flex gap-2">
        {[cityA, cityB].map((city) => (
          <div
            key={city.city}
            className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ring-1 ring-slate-900/15 bg-white/60 min-w-0"
          >
            <Flag country={city.country} />
            <button
              onClick={() => onCityClick?.(city)}
              className="font-serif italic text-[12px] text-slate-900 truncate flex-1 text-left hover:text-amber-700 transition-colors"
            >
              {city.city}
            </button>
            <button
              onClick={() => onRemove?.(city)}
              aria-label={`Remove ${city.city}`}
              className="text-[9px] text-slate-400 hover:text-slate-900 transition-colors leading-none flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
