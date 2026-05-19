"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer, SolidPolygonLayer } from "@deck.gl/layers";
import {
  STOP_MAP,
  GREEN_RED_STOPS,
  getColor,
  bubbleColor,
  stopsToGradient,
} from "../lib/colorScales";
import CityDetailPanel from "../components/CityDetailPanel";
import CitySearch from "../components/CitySearch";
import { countryToISO } from "../lib/countryFlags";

// Cells match the 0.25° grid step exactly — eliminates visible seams between cells.
// Opacity is reduced slightly in colorScales.getColor to compensate for the larger fill area.
const CELL_SIZE = 0.25;
const HALF = CELL_SIZE / 2;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const VARIABLE_SHORT = { temperature: "Temp", precipitation: "Rain", sunshine: "Sun" };

// Fixed color scale ranges per variable — these stay constant across all months so the user
// can visually compare across months (e.g. January looks blue, July looks red). Dynamic
// per-month scaling was misleading: winter appeared as red as summer because the scale
// always stretched to fill the data range of that single month.
const VARIABLES = {
  temperature: { label: "Temperature", unit: "°C", fixedMin: -15, fixedMax: 35 },
  precipitation: { label: "Precipitation", unit: "mm", fixedMin: 0, fixedMax: 200 },
  sunshine: { label: "Sunshine", unit: "hrs/day", fixedMin: 0, fixedMax: 14 },
};

// Bubble metric definitions. `unitPrefix: true` puts the unit before the value (€10),
// otherwise the unit is suffixed (10°C, 10%).
const BUBBLE_METRICS = {
  resilience_score: {
    label: "Resilience Score",
    unit: "",
    getValue: (d) => d.resilience_score,
    invert: true,
  },
  "cost-of-living-index": {
    label: "Cost of Living",
    unit: "",
    getValue: (d) => d["cost-of-living-index"],
    invert: false,
  },
  "one-bedroom-city-rent": {
    label: "1-Bed Rent",
    unit: "€",
    unitPrefix: true,
    getValue: (d) => d["one-bedroom-city-rent"],
    invert: false,
  },
  delta_temp_c: {
    label: "Temp Change",
    unit: "°C",
    getValue: (d) => d.delta_temp_c,
    invert: false,
  },
  delta_precip_pct: {
    label: "Precip Change",
    unit: "%",
    getValue: (d) => d.delta_precip_pct != null ? Math.abs(d.delta_precip_pct) : null,
    invert: false,
  },
};

function formatMetric(value, metric, decimals = 1) {
  if (value == null) return "N/A";
  const v = value.toFixed(decimals);
  return metric.unitPrefix ? `${metric.unit}${v}` : `${v}${metric.unit}`;
}

export default function Home() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  // Holds the most recent instance of each deck.gl layer so each effect can update
  // independently without rebuilding the others.
  const layersRef = useRef({ heatmap: null, borders: null, cities: null });

  const [month, setMonth] = useState(6);
  const [variable, setVariable] = useState("temperature");
  const [bubbleMetric, setBubbleMetric] = useState("resilience_score");
  const [climateData, setClimateData] = useState(null);
  const [cities, setCities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [compareCities, setCompareCities] = useState([]);
  const [addingCompareSlot, setAddingCompareSlot] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [borders, setBorders] = useState(null);
  const bubbleRange = useMemo(() => {
    if (!cities) return { min: 0, max: 1 };
    const metric = BUBBLE_METRICS[bubbleMetric];
    const vals = cities.map(metric.getValue).filter((v) => v != null);
    return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 1 };
  }, [cities, bubbleMetric]);
  const cache = useRef({});

  const fetchMonth = useCallback((monthIdx) => {
    const key = MONTH_KEYS[monthIdx];
    if (cache.current[key]) {
      setClimateData(cache.current[key]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/data/climate_normals/climate_${key}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${key}`);
        return res.json();
      })
      .then((data) => {
        cache.current[key] = data;
        setClimateData(data);
      })
      .catch((err) => {
        console.error("Failed to load climate data:", err);
        setError(`Could not load ${MONTH_NAMES[monthIdx]} climate data.`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMonth(month);
    fetch("/data/cities_all.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading cities`);
        return res.text();
      })
      .then((txt) => JSON.parse(txt.replace(/NaN/g, "null")))
      .then(setCities)
      .catch((err) => {
        console.error("Failed to load cities:", err);
        setError("Could not load city data.");
      });
    // Natural Earth boundary lines, pre-clipped to Europe. Drawn above the heatmap
    // so borders stay legible even when the basemap's subtle gray lines get washed
    // out by the colored heatmap.
    fetch("/data/borders.geojson")
      .then((res) => res.ok ? res.json() : null)
      .then(setBorders)
      .catch(() => {});
    // fetchMonth is stable (useCallback with []) — including it satisfies the lint rule.
    // `month` is intentionally omitted: this effect runs only on mount; subsequent month
    // changes flow through handleMonthChange, which calls fetchMonth directly.
  }, [fetchMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [10, 50],
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 10,
      // Locked to Europe. Southern bound 34°N aligns with the heatmap grid's southern
      // edge so there's no bare base map below the data.
      maxBounds: [[-26, 34], [46, 72]],
    });
    // Interleaved mode lets deck.gl layers participate in MapLibre's layer ordering.
    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(overlay);
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // CartoDB Positron defaults are very subtle. Boost boundary/label visibility so
    // borders and country names stay readable on top of the colored heatmap.
    map.on("style.load", () => {
      try { map.setPaintProperty("boundary_country_outline", "line-width", 1.5); } catch {}
      try { map.setPaintProperty("boundary_country_outline", "line-opacity", 0.8); } catch {}
      try { map.setPaintProperty("boundary_country_inner", "line-width", 1.2); } catch {}
      try { map.setPaintProperty("boundary_country_inner", "line-opacity", 0.7); } catch {}
      try { map.setPaintProperty("boundary_state", "line-width", 0.8); } catch {}
      try { map.setPaintProperty("boundary_state", "line-opacity", 0.6); } catch {}
      const countryLabelLayers = ["place_country_1", "place_country_2"];
      for (const id of countryLabelLayers) {
        try { map.setPaintProperty(id, "text-halo-width", 3); } catch {}
        try { map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,1)"); } catch {}
        try { map.setPaintProperty(id, "text-color", "#1a1a1a"); } catch {}
        try { map.setPaintProperty(id, "text-opacity", 1); } catch {}
        try { map.setLayoutProperty(id, "text-size", 16); } catch {}
      }
      try { map.setPaintProperty("place_state", "text-halo-width", 2); } catch {}
      try { map.setPaintProperty("place_state", "text-halo-color", "rgba(255,255,255,0.9)"); } catch {}
      try { map.setPaintProperty("place_state", "text-opacity", 1); } catch {}
    });

    mapRef.current = map;
    overlayRef.current = overlay;
    return () => map.remove();
  }, []);

  const flushLayers = useCallback(() => {
    if (!overlayRef.current) return;
    const { heatmap, borders: bordersLayer, cities: cityLayer } = layersRef.current;
    // Order matters: heatmap (bottom) → borders → city bubbles (top).
    overlayRef.current.setProps({
      layers: [heatmap, bordersLayer, cityLayer].filter(Boolean),
    });
  }, []);

  // Heatmap layer — rebuilds only when climate data or selected variable changes.
  // beforeId "boundary_county" is the first boundary layer in CartoDB Positron, so the
  // heatmap renders below all borders and labels in interleaved mode.
  useEffect(() => {
    if (!climateData || !overlayRef.current) return;
    const { lats, lons } = climateData;
    const grid = climateData[variable];
    const { fixedMin: vMin, fixedMax: vMax } = VARIABLES[variable];

    const cells = [];
    for (let i = 0; i < lats.length; i++) {
      for (let j = 0; j < lons.length; j++) {
        const val = grid[i][j];
        if (val === null || val === undefined) continue;
        cells.push({
          polygon: [
            [lons[j] - HALF, lats[i] - HALF],
            [lons[j] + HALF, lats[i] - HALF],
            [lons[j] + HALF, lats[i] + HALF],
            [lons[j] - HALF, lats[i] + HALF],
          ],
          value: val,
          i,
          j,
        });
      }
    }

    layersRef.current.heatmap = new SolidPolygonLayer({
      id: "climate-heatmap",
      beforeId: "boundary_county",
      data: cells,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => getColor(variable, d.value, vMin, vMax),
      extruded: false,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          const { i, j } = info.object;
          setHoverInfo({
            type: "grid",
            x: info.x,
            y: info.y,
            temp: climateData.temperature[i][j],
            precip: climateData.precipitation[i][j],
            sun: climateData.sunshine[i][j],
            lat: lats[i],
            lon: lons[j],
          });
        } else {
          setHoverInfo(null);
        }
      },
    });
    flushLayers();
  }, [climateData, variable, flushLayers]);

  // Borders overlay — rebuilds once when the GeoJSON loads. beforeId "place_continent"
  // is the lowest place/label layer in CartoDB Positron, so borders render ABOVE the
  // heatmap and basemap boundaries but BELOW all country/city labels.
  useEffect(() => {
    if (!borders || !overlayRef.current) return;
    layersRef.current.borders = new GeoJsonLayer({
      id: "country-borders",
      beforeId: "place_continent",
      data: borders,
      stroked: true,
      filled: false,
      pickable: false,
      getLineColor: [40, 40, 40, 220],
      getLineWidth: 1,
      lineWidthMinPixels: 1.2,
      lineWidthMaxPixels: 2.5,
    });
    flushLayers();
  }, [borders, flushLayers]);

  // City bubble layer — rebuilds only when the city dataset, selected metric, or color
  // range changes. Omitting beforeId places this layer at the top of the MapLibre stack
  // so bubbles near coastlines stay as complete circles (not clipped by water polygons).
  useEffect(() => {
    if (!cities || !overlayRef.current) return;
    const metric = BUBBLE_METRICS[bubbleMetric];
    const { min: bMin, max: bMax } = bubbleRange;

    layersRef.current.cities = new ScatterplotLayer({
      id: "city-bubbles",
      data: cities,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: 18000,
      getFillColor: (d) => bubbleColor(metric.getValue(d), bMin, bMax, metric.invert),
      getLineColor: [40, 40, 40, 200],
      getLineWidth: 1,
      lineWidthMinPixels: 1.5,
      stroked: true,
      radiusMinPixels: 4,
      radiusMaxPixels: 25,
      // deck.gl only re-evaluates accessor functions when it detects a data change.
      // Since the `cities` array reference is stable across metric switches, we tell
      // deck.gl which accessors depend on which values via updateTriggers.
      updateTriggers: {
        getFillColor: [bubbleMetric, bMin, bMax],
      },
      pickable: true,
      onClick: (info) => {
        if (info.object) {
          setSelectedCity(info.object);
          setFilterExpanded(false);
        }
      },
      onHover: (info) => {
        if (info.object) {
          const c = info.object;
          const val = metric.getValue(c);
          setHoverInfo({
            type: "city",
            x: info.x,
            y: info.y,
            city: c.city,
            country: c.country,
            metricLabel: metric.label,
            metricFormatted: formatMetric(val, metric),
          });
        } else {
          setHoverInfo(null);
        }
      },
    });
    flushLayers();
  }, [cities, bubbleMetric, bubbleRange, flushLayers]);

  const handleMonthChange = (e) => {
    const idx = Number(e.target.value);
    setMonth(idx);
    fetchMonth(idx);
  };

  const handleToggleCompare = useCallback((city) => {
    setCompareCities((prev) => {
      const already = prev.find((c) => c.city === city.city);
      if (already) return prev.filter((c) => c.city !== city.city);
      if (prev.length >= 2) return prev;
      return [...prev, city];
    });
  }, []);

  const handleCitySelect = useCallback((city) => {
    if (!city) return;
    setSelectedCity(city);
    setFilterExpanded(false);
    if (mapRef.current && city.lat != null && city.lon != null) {
      mapRef.current.flyTo({
        center: [city.lon, city.lat],
        zoom: 6,
        duration: 1200,
        essential: true,
      });
    }
  }, []);

  // Placeholder for the month auto-cycle feature (Phase 3).
  const handlePlayClick = () => {};

  const { unit } = VARIABLES[variable];
  const currentBubbleMetric = BUBBLE_METRICS[bubbleMetric];
  const { min: bMin, max: bMax } = bubbleRange;

  const variableKeys = Object.keys(VARIABLES);
  const variableIdx = variableKeys.indexOf(variable);

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans">
      <div ref={mapContainer} className="w-full h-full" />

      {/* === Mobile backdrops ========================================= */}
      {filterExpanded && (
        <div
          className="sm:hidden fixed inset-0 z-[35] bg-slate-900/10"
          onClick={() => setFilterExpanded(false)}
        />
      )}
      {selectedCity && (
        <div
          className="sm:hidden fixed inset-0 z-[55] bg-slate-900/20"
          onClick={() => setSelectedCity(null)}
        />
      )}

      {/* === Filter Board ============================================== */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[40] h-[84vh] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${filterExpanded ? "translate-y-0" : "translate-y-[calc(100%-72px)]"} sm:absolute sm:bottom-auto sm:top-5 sm:left-5 sm:right-auto sm:w-[300px] sm:h-auto sm:translate-y-0 sm:transition-none bg-white/92 sm:bg-white/85 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl ring-1 ring-slate-900/[0.06] shadow-[0_-8px_32px_rgba(15,23,42,0.08)] sm:shadow-[0_8px_32px_rgba(15,23,42,0.10)] overflow-hidden`}
      >
          {/* Hairline amber accent at the very top — sets the visual identity */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

          {/* Mobile drag handle + tap-to-expand collapsed header */}
          <button
            className="sm:hidden w-full flex flex-col items-center pt-2.5"
            onClick={() => setFilterExpanded((v) => !v)}
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
              <CitySearch cities={cities} onSelect={handleCitySelect} />
            </div>

            {/* ── Month ──────────────────────────────────────────────── */}
            <div className="pt-4 mt-4 border-t border-slate-900/10">
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400">
                  Month
                </p>
                <button
                  onClick={handlePlayClick}
                  disabled={loading}
                  className="group flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 hover:text-amber-600 transition-colors disabled:opacity-40"
                >
                  <span className="text-[8px] leading-none transition-transform group-hover:translate-x-0.5">▶</span>
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
                  onChange={handleMonthChange}
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
                    onClick={() => setVariable(key)}
                    className={`relative z-10 py-1.5 text-[11px] font-medium transition-colors ${
                      variable === key ? "text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {VARIABLES[key].label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <div
                  className="w-full h-1.5 rounded-full ring-1 ring-slate-900/[0.04]"
                  style={{ background: stopsToGradient(STOP_MAP[variable]) }}
                />
                <div className="flex justify-between mt-1.5 font-mono text-[9px] tabular-nums text-slate-500">
                  <span>{VARIABLES[variable].fixedMin} {unit}</span>
                  <span>{VARIABLES[variable].fixedMax} {unit}</span>
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
                  onChange={(e) => setBubbleMetric(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-9 rounded-lg text-[12px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 border-0 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer transition-colors"
                >
                  {Object.entries(BUBBLE_METRICS).map(([key, { label: lbl }]) => (
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
                {[0, 1].map((slotIdx) => {
                  const city = compareCities[slotIdx];
                  if (city) {
                    const iso = countryToISO(city.country?.trim());
                    return (
                      <div
                        key={`pinned-${city.city}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ring-1 ring-slate-900/15 bg-white/60 min-w-0"
                      >
                        {iso && (
                          <img
                            src={`https://flagcdn.com/w20/${iso}.webp`}
                            alt=""
                            className="h-3 w-auto rounded-[1px] flex-shrink-0 ring-1 ring-slate-900/[0.04]"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        )}
                        <span className="font-serif italic text-[13px] text-slate-900 flex-1 truncate leading-tight">
                          {city.city}
                        </span>
                        <button
                          onClick={() => handleToggleCompare(city)}
                          aria-label={`Remove ${city.city} from comparison`}
                          className="text-[9px] text-slate-400 hover:text-slate-900 transition-colors leading-none flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  }
                  // Only render the next empty slot, not any beyond it
                  if (slotIdx > compareCities.length) return null;
                  const isActiveSlot = slotIdx === compareCities.length;
                  if (isActiveSlot && addingCompareSlot) {
                    return (
                      <div
                        key={`search-${slotIdx}`}
                        onBlur={(e) => {
                          // Collapse only if focus left the entire search container
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            setTimeout(() => setAddingCompareSlot(false), 120);
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
                            handleToggleCompare(city);
                            setAddingCompareSlot(false);
                          }}
                        />
                      </div>
                    );
                  }
                  return (
                    <button
                      key={`add-${slotIdx}`}
                      onClick={() => setAddingCompareSlot(true)}
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
                })}
              </div>
              {compareCities.length === 2 && (
                <button
                  onClick={() => setSelectedCity(compareCities[0])}
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

      {/* === Hover tooltip ============================================ */}
      {hoverInfo && (
        <div
          className="absolute pointer-events-none bg-white/95 backdrop-blur-md rounded-lg ring-1 ring-slate-900/10 shadow-[0_4px_20px_rgba(15,23,42,0.12)] px-3 py-2 text-xs leading-relaxed z-40"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
        >
          {hoverInfo.type === "city" ? (
            <>
              <div className="font-serif italic text-[15px] text-slate-900 leading-tight">{hoverInfo.city}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 mt-0.5">
                {hoverInfo.country?.trim()}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-900/[0.08] flex items-baseline justify-between gap-4">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
                  {hoverInfo.metricLabel}
                </span>
                <span className="font-mono text-[11px] tabular-nums font-medium text-slate-900">
                  {hoverInfo.metricFormatted}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 tabular-nums">
                {hoverInfo.lat.toFixed(2)}°N · {hoverInfo.lon.toFixed(2)}°E
              </div>
              <div className="mt-1.5 space-y-0.5">
                <div className="flex justify-between gap-4 font-mono text-[10px] tabular-nums">
                  <span className="text-slate-500">Temperature</span>
                  <span className="text-slate-900 font-medium">
                    {hoverInfo.temp != null ? `${hoverInfo.temp.toFixed(1)} °C` : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 font-mono text-[10px] tabular-nums">
                  <span className="text-slate-500">Precipitation</span>
                  <span className="text-slate-900 font-medium">
                    {hoverInfo.precip != null ? `${hoverInfo.precip.toFixed(1)} mm` : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 font-mono text-[10px] tabular-nums">
                  <span className="text-slate-500">Sunshine</span>
                  <span className="text-slate-900 font-medium">
                    {hoverInfo.sun != null ? `${hoverInfo.sun.toFixed(1)} h/day` : "—"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <CityDetailPanel
        city={selectedCity}
        onClose={() => setSelectedCity(null)}
        compareCities={compareCities}
        onToggleCompare={handleToggleCompare}
        onCitySelect={(city) => { setSelectedCity(city); handleCitySelect(city); }}
        climateData={climateData}
        month={month}
      />
    </div>
  );
}
