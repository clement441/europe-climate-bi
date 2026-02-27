"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, SolidPolygonLayer } from "@deck.gl/layers";

// Cells slightly smaller than 0.25° grid spacing so borders/coastlines show through gaps
const CELL_SIZE = 0.21;
const HALF = CELL_SIZE / 2;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

// Fixed color scale ranges per variable — these stay constant across all months so the user
// can visually compare across months (e.g. January looks blue, July looks red). Dynamic
// per-month scaling was misleading: winter appeared as red as summer because the scale
// always stretched to fill the data range of that single month.
const VARIABLES = {
  temperature: { label: "Temperature", unit: "°C", fixedMin: -15, fixedMax: 35 },
  precipitation: { label: "Precipitation", unit: "mm", fixedMin: 0, fixedMax: 200 },
  sunshine: { label: "Sunshine", unit: "hrs/day", fixedMin: 0, fixedMax: 14 },
};

// Bubble metric definitions
const BUBBLE_METRICS = {
  resilience_score: {
    label: "Resilience Score",
    unit: "",
    getValue: (d) => d.resilience_score,
    invert: true, // high = green
  },
  "cost-of-living-index": {
    label: "Cost of Living",
    unit: "",
    getValue: (d) => d["cost-of-living-index"],
    invert: false, // high = red (expensive)
  },
  "one-bedroom-city-rent": {
    label: "1-Bed Rent",
    unit: "€",
    getValue: (d) => d["one-bedroom-city-rent"],
    invert: false,
  },
  delta_temp_c: {
    label: "Temp Change",
    unit: "°C",
    getValue: (d) => d.delta_temp_c,
    invert: false, // high = red (more warming)
  },
  delta_precip_pct: {
    label: "Precip Change",
    unit: "%",
    getValue: (d) => d.delta_precip_pct != null ? Math.abs(d.delta_precip_pct) : null,
    invert: false, // high abs = red (more change)
  },
};

// --- Color scales ---
function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function multiStopColor(ratio, stops) {
  if (ratio <= stops[0].at) return stops[0].color;
  if (ratio >= stops[stops.length - 1].at) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio <= stops[i + 1].at) {
      const t = (ratio - stops[i].at) / (stops[i + 1].at - stops[i].at);
      return lerp(stops[i].color, stops[i + 1].color, t);
    }
  }
  return stops[stops.length - 1].color;
}

const TEMP_STOPS = [
  { at: 0, color: [33, 102, 172] },
  { at: 0.5, color: [255, 255, 255] },
  { at: 1, color: [178, 24, 43] },
];
const PRECIP_STOPS = [
  { at: 0, color: [255, 255, 204] },
  { at: 0.4, color: [65, 182, 196] },
  { at: 1, color: [12, 44, 132] },
];
const SUN_STOPS = [
  { at: 0, color: [74, 20, 134] },
  { at: 0.2, color: [43, 140, 190] },
  { at: 0.4, color: [166, 217, 237] },
  { at: 0.6, color: [254, 227, 145] },
  { at: 0.8, color: [244, 109, 67] },
  { at: 1, color: [255, 204, 0] },
];
const STOP_MAP = { temperature: TEMP_STOPS, precipitation: PRECIP_STOPS, sunshine: SUN_STOPS };

function getColor(variable, value, min, max) {
  const range = max - min;
  const ratio = range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  const [r, g, b] = multiStopColor(ratio, STOP_MAP[variable]);
  return [r, g, b, 179];
}

// Green→yellow→red gradient for city bubbles
const GREEN_RED_STOPS = [
  { at: 0, color: [34, 139, 34] },
  { at: 0.5, color: [255, 200, 0] },
  { at: 1, color: [200, 30, 30] },
];

function bubbleColor(value, min, max, invert) {
  if (value == null) return [160, 160, 160, 220];
  const range = max - min;
  let ratio = range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  if (invert) ratio = 1 - ratio;
  const [r, g, b] = multiStopColor(ratio, GREEN_RED_STOPS);
  return [r, g, b, 220];
}

// --- Formatters ---
function fmtPrice(v) {
  return v != null ? `€${Math.round(v)}` : "N/A";
}
function fmtTemp(v) {
  return v != null ? `${v.toFixed(1)}°C` : "N/A";
}
function fmtPct(v) {
  return v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "N/A";
}
function fmtNum(v, dec = 1) {
  return v != null ? v.toFixed(dec) : "N/A";
}

// Build a CSS linear-gradient string from color stops
function stopsToGradient(stops) {
  const parts = stops.map(
    (s) => `rgb(${s.color[0]},${s.color[1]},${s.color[2]}) ${s.at * 100}%`
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

// Risk tier badge colors
function riskBadge(tier) {
  switch (tier) {
    case "Low Risk": return "bg-green-100 text-green-800";
    case "Moderate Risk": return "bg-yellow-100 text-yellow-800";
    case "High Risk": return "bg-orange-100 text-orange-800";
    case "Critical": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-600";
  }
}
function riskBarColor(tier) {
  switch (tier) {
    case "Low Risk": return "bg-green-500";
    case "Moderate Risk": return "bg-yellow-500";
    case "High Risk": return "bg-orange-500";
    case "Critical": return "bg-red-500";
    default: return "bg-gray-400";
  }
}

// --- Detail panel row helper ---
function DetailRow({ label, value, className = "" }) {
  const isNA = value === "N/A";
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-500">{label}</span>
      <span className={isNA ? "text-gray-300" : `font-medium text-gray-900 ${className}`}>{value}</span>
    </div>
  );
}

// --- City detail panel ---
function CityDetailPanel({ city, onClose }) {
  if (!city) return null;
  return (
    <div className="absolute top-0 right-0 z-50 w-full sm:w-[350px] h-full bg-white shadow-2xl overflow-y-auto border-l border-gray-200">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-lg"
      >
        ✕
      </button>

      <div className="p-5 space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 pr-8">{city.city}</h2>
          <p className="text-sm text-gray-500">{city.country}</p>
          {city.risk_tier && (
            <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge(city.risk_tier)}`}>
              {city.risk_tier}
            </span>
          )}
        </div>

        {/* Cost of Living */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Cost of Living</h3>
          <div className="text-xs divide-y divide-gray-50">
            <DetailRow label="Cost of Living Index" value={fmtNum(city["cost-of-living-index"])} />
            <DetailRow label="1-Bed Rent (city)" value={fmtPrice(city["one-bedroom-city-rent"])} />
            <DetailRow label="3-Bed Rent (city)" value={fmtPrice(city["three-bedroom-city-rent"])} />
            <DetailRow label="Restaurant Meal" value={fmtPrice(city["meal-restaurant"])} />
            <DetailRow label="Public Transport (monthly)" value={fmtPrice(city["monthly-public-transport-pass"])} />
            <DetailRow label="Basic Utilities (85m²)" value={fmtPrice(city["basic-utilities-85m2-apartment"])} />
            <DetailRow label="Cinema Ticket" value={fmtPrice(city["cinema-ticket"])} />
            <DetailRow label="Price/m² (buy)" value={fmtPrice(city["price-square-meter-buy"])} />
          </div>
        </div>

        {/* Groceries */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Groceries</h3>
          <div className="text-xs divide-y divide-gray-50">
            <DetailRow label="Milk (1L)" value={fmtPrice(city["1l-milk"])} />
            <DetailRow label="Chicken (1kg)" value={fmtPrice(city["chicken"])} />
            <DetailRow label="Bread (500g)" value={fmtPrice(city["bread"])} />
            <DetailRow label="Rice (1kg)" value={fmtPrice(city["rice"])} />
          </div>
        </div>

        {/* Climate Projections */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Climate Projections</h3>
          <div className="text-xs divide-y divide-gray-50">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Temperature</span>
              <span className="font-medium text-gray-900">
                {fmtTemp(city.baseline_temp_c)} → {fmtTemp(city.future_temp_c)}
                {city.delta_temp_c != null && (
                  <span className="ml-1 text-red-600">(+{city.delta_temp_c.toFixed(1)}°C)</span>
                )}
              </span>
            </div>
            <DetailRow
              label="Summer Temp Change"
              value={city.delta_summer_temp_c != null ? `+${city.delta_summer_temp_c.toFixed(1)}°C` : "N/A"}
              className="text-red-600"
            />
            <DetailRow
              label="Precipitation Change"
              value={fmtPct(city.delta_precip_pct)}
              className={city.delta_precip_pct != null ? (city.delta_precip_pct >= 0 ? "text-green-600" : "text-red-600") : ""}
            />
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Extreme Heat Days</span>
              <span className="font-medium text-gray-900">
                {fmtNum(city.baseline_heat_days, 0)} → {fmtNum(city.future_heat_days, 0)}
                {city.delta_heat_days != null && (
                  <span className="ml-1 text-red-600">(+{city.delta_heat_days.toFixed(0)})</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Resilience */}
        {city.resilience_score != null && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Resilience</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${riskBarColor(city.risk_tier)}`}
                  style={{ width: `${city.resilience_score}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-800 w-10 text-right">
                {city.resilience_score.toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);

  const [month, setMonth] = useState(6);
  const [variable, setVariable] = useState("temperature");
  const [bubbleMetric, setBubbleMetric] = useState("resilience_score");
  const [climateData, setClimateData] = useState(null);
  const [cities, setCities] = useState(null);
  const [loading, setLoading] = useState(false);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const cache = useRef({});

  // Compute bubble metric range from city data
  const bubbleRange = useRef({ min: 0, max: 1 });
  useEffect(() => {
    if (!cities) return;
    const metric = BUBBLE_METRICS[bubbleMetric];
    const vals = cities.map(metric.getValue).filter((v) => v != null);
    if (vals.length) {
      bubbleRange.current = { min: Math.min(...vals), max: Math.max(...vals) };
    }
  }, [cities, bubbleMetric]);

  const fetchMonth = useCallback((monthIdx) => {
    const key = MONTH_KEYS[monthIdx];
    if (cache.current[key]) {
      setClimateData(cache.current[key]);
      return;
    }
    setLoading(true);
    fetch(`/data/climate_normals/climate_${key}.json`)
      .then((res) => res.json())
      .then((data) => {
        cache.current[key] = data;
        setClimateData(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMonth(month);
    fetch("/data/cities_all.json")
      .then((res) => res.text())
      .then((txt) => JSON.parse(txt.replace(/NaN/g, "null")))
      .then(setCities);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Lock the map to Europe so the user cannot pan to other continents.
      // maxBounds takes [[west, south], [east, north]].
      // ISSUE 3 FIX: Tightened southern bound from 30°N to 34°N to exclude North Africa
      // (Morocco, Algeria, Tunisia). 34°N aligns with the heatmap grid's southern edge
      // (~34°N) so there's no visible bare base map below the data.
      // Bounds tightened to match the heatmap grid extent: lons -25°W to 45°E, lats 34°N to 72°N.
      // Small padding added so edge cells aren't cut off.
      maxBounds: [[-26, 34], [46, 72]],
    });
    // Interleaved mode lets deck.gl layers participate in MapLibre's layer ordering.
    // Each deck.gl layer can specify `beforeId` to control where it sits in the stack.
    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(overlay);
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // ISSUE 2 FIX: After the style loads, boost boundary and country/region label
    // visibility so they're clearly readable on top of the colored heatmap.
    // CartoDB Positron defaults are very subtle (thin lines, light text) — we increase
    // border widths and add stronger text halos to country/state/region names.
    map.on("style.load", () => {
      // Thicken country boundary lines
      try { map.setPaintProperty("boundary_country_outline", "line-width", 1.5); } catch {}
      try { map.setPaintProperty("boundary_country_outline", "line-opacity", 0.8); } catch {}
      try { map.setPaintProperty("boundary_country_inner", "line-width", 1.2); } catch {}
      try { map.setPaintProperty("boundary_country_inner", "line-opacity", 0.7); } catch {}
      try { map.setPaintProperty("boundary_state", "line-width", 0.8); } catch {}
      try { map.setPaintProperty("boundary_state", "line-opacity", 0.6); } catch {}
      // Boost country name labels — larger halo + darker text so they stand out from regions
      const countryLabelLayers = ["place_country_1", "place_country_2"];
      for (const id of countryLabelLayers) {
        try { map.setPaintProperty(id, "text-halo-width", 3); } catch {}
        try { map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,1)"); } catch {}
        try { map.setPaintProperty(id, "text-color", "#1a1a1a"); } catch {}
        try { map.setPaintProperty(id, "text-opacity", 1); } catch {}
        try { map.setLayoutProperty(id, "text-size", 16); } catch {}
      }
      // Boost region/state name labels
      try { map.setPaintProperty("place_state", "text-halo-width", 2); } catch {}
      try { map.setPaintProperty("place_state", "text-halo-color", "rgba(255,255,255,0.9)"); } catch {}
      try { map.setPaintProperty("place_state", "text-opacity", 1); } catch {}
    });

    mapRef.current = map;
    overlayRef.current = overlay;
    return () => map.remove();
  }, []);

  // Update deck.gl layers
  useEffect(() => {
    if (!climateData || !overlayRef.current) return;

    const { lats, lons } = climateData;
    const grid = climateData[variable];

    // Use fixed color scale ranges so months are visually comparable
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

    // In interleaved mode, beforeId tells MapLibre where to insert this deck.gl layer
    // within the base map's layer stack — "boundary_county" is the first boundary layer
    // in CartoDB Positron, so our heatmap renders below all borders and labels.
    const BEFORE_LABEL_LAYER = "boundary_county";

    const heatmapLayer = new SolidPolygonLayer({
      id: "climate-heatmap",
      beforeId: BEFORE_LABEL_LAYER,
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

    const layers = [heatmapLayer];

    if (cities) {
      const metric = BUBBLE_METRICS[bubbleMetric];
      const { min: bMin, max: bMax } = bubbleRange.current;
      // ISSUE 1 FIX: City bubbles were clipped at coastlines because they shared the
      // same `beforeId` as the heatmap, placing them below boundary/water layers.
      // By omitting `beforeId`, the ScatterplotLayer renders at the very top of the
      // MapLibre stack in interleaved mode — above all base map layers including water
      // polygons — so bubbles near the coast always show as complete circles.
      const cityLayer = new ScatterplotLayer({
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
        // BUG FIX: deck.gl only re-evaluates accessor functions (getFillColor, etc.)
        // when it detects a data change. Since the `cities` array reference stays the
        // same when switching bubble metrics, deck.gl skips recomputing colors.
        // `updateTriggers` tells deck.gl which accessors depend on which values,
        // so it knows to re-evaluate getFillColor when bubbleMetric or the range changes.
        updateTriggers: {
          getFillColor: [bubbleMetric, bMin, bMax],
        },
        pickable: true,
        onClick: (info) => {
          if (info.object) setSelectedCity(info.object);
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
              metricValue: val != null ? val.toFixed(1) : "N/A",
              metricUnit: metric.unit,
            });
          } else {
            setHoverInfo(null);
          }
        },
      });
      layers.push(cityLayer);
    }

    overlayRef.current.setProps({ layers });
  }, [climateData, variable, cities, bubbleMetric]);

  const handleMonthChange = (e) => {
    const idx = Number(e.target.value);
    setMonth(idx);
    fetchMonth(idx);
  };

  const { unit } = VARIABLES[variable];
  const currentBubbleMetric = BUBBLE_METRICS[bubbleMetric];
  const { min: bMin, max: bMax } = bubbleRange.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Controls panel */}
      <div className="absolute top-4 left-4 z-50 bg-white rounded-xl shadow-lg p-4 w-64 text-sm max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Title and branding */}
        <div className="mb-3">
          <h1 className="font-bold text-gray-900 text-base leading-tight">European Climate & Living Costs</h1>
          <p className="text-xs text-gray-400 mt-0.5">Interactive BI Dashboard</p>
        </div>

        {/* Month slider section */}
        <div className="space-y-1 pt-3 border-t border-gray-100">
          <div className="flex justify-between text-gray-600">
            <span>Month</span>
            <span className="font-medium text-gray-900">
              {MONTH_NAMES[month]}
              {loading && (
                <span className="inline-block ml-1.5 w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin align-middle" />
              )}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={11}
            value={month}
            onChange={handleMonthChange}
            disabled={loading}
            className={`w-full accent-blue-600 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          />
        </div>

        {/* Heatmap variable section */}
        <div className="space-y-1.5 pt-3 mt-3 border-t border-gray-100">
          <span className="text-gray-600">Heatmap Variable</span>
          <div className="flex gap-1">
            {Object.entries(VARIABLES).map(([key, { label: lbl }]) => (
              <button
                key={key}
                onClick={() => setVariable(key)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  variable === key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {/* Heatmap color legend — shows fixed scale range, not dynamic per-month */}
          <div className="space-y-1 mt-1">
            <div
              className="w-full h-2.5 rounded-full"
              style={{ background: stopsToGradient(STOP_MAP[variable]) }}
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{VARIABLES[variable].fixedMin} {unit}</span>
              <span>{VARIABLES[variable].fixedMax} {unit}</span>
            </div>
          </div>
        </div>

        {/* Bubble metric section */}
        <div className="space-y-1.5 pt-3 mt-3 border-t border-gray-100">
          <span className="text-gray-600">City Bubbles</span>
          <select
            value={bubbleMetric}
            onChange={(e) => setBubbleMetric(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border-0 focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(BUBBLE_METRICS).map(([key, { label: lbl }]) => (
              <option key={key} value={key}>{lbl}</option>
            ))}
          </select>
          {/* Bubble color legend */}
          {cities && (
            <div className="space-y-1 mt-1">
              <div
                className="w-full h-2.5 rounded-full"
                style={{
                  background: currentBubbleMetric.invert
                    ? stopsToGradient([...GREEN_RED_STOPS].reverse().map((s, i, arr) => ({ ...s, at: i / (arr.length - 1) })))
                    : stopsToGradient(GREEN_RED_STOPS),
                }}
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>{currentBubbleMetric.unit}{bMin.toFixed(1)}</span>
                <span>{currentBubbleMetric.unit}{bMax.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Empty state hint */}
        {!selectedCity && (
          <p className="text-xs text-gray-400 italic pt-3 mt-3 border-t border-gray-100">
            Click a city bubble for details
          </p>
        )}
      </div>

      {/* Hover tooltip */}
      {hoverInfo && (
        <div
          className="absolute pointer-events-none bg-white rounded-lg shadow-lg px-3 py-2 text-xs leading-relaxed z-40"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
        >
          {hoverInfo.type === "city" ? (
            <>
              <div className="font-semibold text-gray-800">{hoverInfo.city}</div>
              <div className="text-gray-500">{hoverInfo.country}</div>
              <div className="text-gray-600 mt-1">
                {hoverInfo.metricLabel}: <span className="font-medium text-gray-900">{hoverInfo.metricUnit}{hoverInfo.metricValue}</span>
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-gray-700 mb-1">
                {hoverInfo.lat.toFixed(2)}°N, {hoverInfo.lon.toFixed(2)}°E
              </div>
              <div className="text-gray-600">Temperature: <span className="font-medium text-gray-900">{hoverInfo.temp.toFixed(1)}°C</span></div>
              <div className="text-gray-600">Precipitation: <span className="font-medium text-gray-900">{hoverInfo.precip.toFixed(1)} mm</span></div>
              <div className="text-gray-600">Sunshine: <span className="font-medium text-gray-900">{hoverInfo.sun.toFixed(1)} h/day</span></div>
            </>
          )}
        </div>
      )}

      {/* City detail panel */}
      <CityDetailPanel city={selectedCity} onClose={() => setSelectedCity(null)} />
    </div>
  );
}
