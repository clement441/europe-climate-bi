"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, SolidPolygonLayer } from "@deck.gl/layers";
import {
  STOP_MAP,
  GREEN_RED_STOPS,
  getColor,
  bubbleColor,
  stopsToGradient,
} from "../lib/colorScales";
import CityDetailPanel from "../components/CityDetailPanel";

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
  // Holds the most recent instance of each deck.gl layer so the heatmap and
  // city-bubble effects can update independently without rebuilding the other.
  const layersRef = useRef({ heatmap: null, cities: null });

  const [month, setMonth] = useState(6);
  const [variable, setVariable] = useState("temperature");
  const [bubbleMetric, setBubbleMetric] = useState("resilience_score");
  const [climateData, setClimateData] = useState(null);
  const [cities, setCities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  // bubbleRange is state (not a ref) so the city-layer effect re-runs when it changes,
  // guaranteeing the layer is rebuilt with the correct color range on first paint.
  const [bubbleRange, setBubbleRange] = useState({ min: 0, max: 1 });
  const cache = useRef({});

  useEffect(() => {
    if (!cities) return;
    const metric = BUBBLE_METRICS[bubbleMetric];
    const vals = cities.map(metric.getValue).filter((v) => v != null);
    if (vals.length) {
      setBubbleRange({ min: Math.min(...vals), max: Math.max(...vals) });
    }
  }, [cities, bubbleMetric]);

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
    const { heatmap, cities: cityLayer } = layersRef.current;
    overlayRef.current.setProps({ layers: [heatmap, cityLayer].filter(Boolean) });
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

  const { unit } = VARIABLES[variable];
  const currentBubbleMetric = BUBBLE_METRICS[bubbleMetric];
  const { min: bMin, max: bMax } = bubbleRange;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Controls panel */}
      <div className="absolute top-4 left-4 z-50 bg-white rounded-xl shadow-lg p-4 w-64 text-sm max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="mb-3">
          <h1 className="font-bold text-gray-900 text-base leading-tight">European Climate & Living Costs</h1>
          <p className="text-xs text-gray-400 mt-0.5">Interactive BI Dashboard</p>
        </div>

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
                <span>{formatMetric(bMin, currentBubbleMetric)}</span>
                <span>{formatMetric(bMax, currentBubbleMetric)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-red-600 bg-red-50 rounded p-2">
            {error}
          </div>
        )}

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
              <div className="text-gray-500">{hoverInfo.country?.trim()}</div>
              <div className="text-gray-600 mt-1">
                {hoverInfo.metricLabel}: <span className="font-medium text-gray-900">{hoverInfo.metricFormatted}</span>
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-gray-700 mb-1">
                {hoverInfo.lat.toFixed(2)}°N, {hoverInfo.lon.toFixed(2)}°E
              </div>
              <div className="text-gray-600">
                Temperature: <span className="font-medium text-gray-900">
                  {hoverInfo.temp != null ? `${hoverInfo.temp.toFixed(1)}°C` : "N/A"}
                </span>
              </div>
              <div className="text-gray-600">
                Precipitation: <span className="font-medium text-gray-900">
                  {hoverInfo.precip != null ? `${hoverInfo.precip.toFixed(1)} mm` : "N/A"}
                </span>
              </div>
              <div className="text-gray-600">
                Sunshine: <span className="font-medium text-gray-900">
                  {hoverInfo.sun != null ? `${hoverInfo.sun.toFixed(1)} h/day` : "N/A"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <CityDetailPanel city={selectedCity} onClose={() => setSelectedCity(null)} />
    </div>
  );
}
