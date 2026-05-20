"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer, SolidPolygonLayer } from "@deck.gl/layers";
import { getColor, bubbleColor } from "../lib/colorScales";
import { MONTH_NAMES, MONTH_KEYS } from "../lib/constants";
import { formatMetric } from "../lib/utils";
import CityDetailPanel from "../components/CityDetailPanel";
import FilterBoard from "../components/FilterBoard";

// Cells match the 0.25° grid step exactly — eliminates visible seams between cells.
// Opacity is reduced slightly in colorScales.getColor to compensate for the larger fill area.
const CELL_SIZE = 0.25;
const HALF = CELL_SIZE / 2;

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
    return vals.length
      ? { min: vals.reduce((a, b) => Math.min(a, b)), max: vals.reduce((a, b) => Math.max(a, b)) }
      : { min: 0, max: 1 };
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
      const key = (c) => `${c.city}|${c.country}`;
      const already = prev.find((c) => key(c) === key(city));
      if (already) return prev.filter((c) => key(c) !== key(city));
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

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans">
      <div ref={mapContainer} className="w-full h-full" role="region" aria-label="Interactive climate map of Europe" />

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
      <FilterBoard
        month={month}
        onMonthChange={handleMonthChange}
        loading={loading}
        error={error}
        variable={variable}
        variables={VARIABLES}
        onVariableChange={setVariable}
        bubbleMetric={bubbleMetric}
        bubbleMetrics={BUBBLE_METRICS}
        onBubbleMetricChange={setBubbleMetric}
        bubbleRange={bubbleRange}
        cities={cities}
        onCitySelect={handleCitySelect}
        onViewCompare={setSelectedCity}
        compareCities={compareCities}
        addingCompareSlot={addingCompareSlot}
        onAddingCompareSlotChange={setAddingCompareSlot}
        onToggleCompare={handleToggleCompare}
        selectedCity={selectedCity}
        filterExpanded={filterExpanded}
        onToggleExpanded={() => setFilterExpanded((v) => !v)}
      />

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
