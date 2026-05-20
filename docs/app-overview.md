# App Overview -- European Climate & Living Costs BI Dashboard

## 1. What This App Is

This is an interactive map dashboard that lets anyone explore climate patterns and cost-of-living data across Europe. You can see how warm, rainy, or sunny different parts of Europe are in any given month, then zoom into individual cities to compare rent prices, grocery costs, and how much each city is expected to warm by 2050. The app is intended as a freelance portfolio piece demonstrating end-to-end data skills: pulling raw satellite/reanalysis data from a scientific archive, processing it with Python, and shipping a polished browser-based visualization.


## 2. Framework / Tech Stack Explainer

**Next.js 16 (React 19, App Router, static export)**
Next.js is a React framework that handles page routing, server-side rendering, and build tooling. In this app it is used in "static export" mode -- meaning the build step produces plain HTML/JS/CSS files with no Node.js server. The output is deployed to Vercel as a static site. There is only one page (the map), so routing is trivial; the App Router is used mainly for layout and metadata.

**MapLibre GL JS 5**
MapLibre is a JavaScript library for rendering interactive, GPU-accelerated tile maps in the browser. It loads and displays the CartoDB Positron basemap (a light gray street/country map served free from CartoDB's CDN), handles panning/zooming, and provides the HTML canvas that all the data layers render into.

**Deck.gl 9**
Deck.gl is a WebGL library (built by Uber) for rendering large data overlays on top of map libraries. It is used here in "interleaved mode" via MapboxOverlay, which means its layers are inserted into MapLibre's own layer stack -- so the heatmap appears underneath country borders and city labels rather than floating above everything. Three Deck.gl layer types are used: SolidPolygonLayer (heatmap cells), GeoJsonLayer (country borders), and ScatterplotLayer (city bubbles).

**Tailwind CSS 4**
Tailwind is a CSS framework where you style elements using short utility class names directly in the HTML/JSX. It is used for all UI panel styling -- the filter board, city detail panel, tooltips, and mobile bottom-sheet layout. No custom CSS files are used except for a small globals.css that defines font variables and two keyframe animations.

**Fuse.js 7**
Fuse.js is a fuzzy-search library that finds approximate text matches. It powers the city search box: when you type "munick" it still finds Munich. Search weights city name more than country name (0.7 vs 0.3) and returns up to 8 results.


## 3. File Structure and Routes

```
europe-climate-bi/
  web/                         -- Next.js app (Vercel root directory)
    src/
      app/
        layout.js              -- HTML shell: page title, Open Graph meta, three Google Fonts
        page.js                -- the entire app at "/" -- map init, all state, all layers
        globals.css            -- Tailwind import + two keyframe animations (slide-up, tab-fade)
      components/
        FilterBoard.js         -- left-side control panel: month slider, variable/metric selectors,
                               --   city search embed, compare tray, mobile bottom-sheet
        CityDetailPanel.js     -- right-side city panel: header, Climate/Cost/Resilience tabs,
                               --   sparkline, ring gauge, switches to ComparePanel when 2 pinned
        ComparePanel.js        -- side-by-side bar chart for 2 cities across 7 metrics
        CitySearch.js          -- fuzzy search input with keyboard nav and dropdown
        Flag.js                -- renders a country flag via flagcdn.com CDN img tag
      lib/
        colorScales.js         -- color interpolation for heatmap (3 scales) and bubbles (1 scale)
        constants.js           -- MONTH_NAMES and MONTH_KEYS arrays
        countryFlags.js        -- country name -> ISO 3166-1 alpha-2 lookup table
        gridUtils.js           -- nearestIdx and nearestGridValue helpers for grid lookups
        utils.js               -- formatMetric: formats a numeric value with its unit
    public/
      data/
        cities_all.json        -- 231 cities, each with identity, cost, climate, resilience fields
        borders.geojson        -- Natural Earth country boundary lines, pre-clipped to Europe
        climate_normals/
          climate_jan.json     -- monthly climate grid: lats[], lons[], temperature[][], precipitation[][], sunshine[][]
          climate_feb.json     -- (same structure, one file per month)
          ... (12 files total, ~1 MB each)
          metadata.json        -- grid dimensions, coordinate arrays, unit definitions
      favicon.svg
    next.config.mjs            -- static export mode, transpilePackages for deck.gl
    package.json               -- dependencies: deck.gl 9, maplibre-gl 5, fuse.js 7, next 16
    postcss.config.mjs         -- Tailwind PostCSS plugin

  scripts/                     -- Python data pipeline (run from repo root)
    process_era5.py            -- Pipeline A: ERA5 NetCDF -> 12 monthly JSON climate normals
    geocode_cities.py          -- Pipeline B step 1: Nominatim lat/lon lookup -> cities_master.csv
    fetch_projections.py       -- Pipeline B step 2: Open-Meteo API -> climate_projections.csv
    build_city_dataset.py      -- Pipeline B step 3: merge all inputs, compute resilience score -> cities_all.json

  data/
    raw/                       -- ~4 GB ERA5 NetCDF files + cost-of-living.csv (gitignored)
    processed/                 -- committed outputs: cities_master.csv, climate_projections.csv,
                               --   cities_all.json, climate_normals/ JSON files

  requirements.txt             -- Python dependencies (xarray, pandas, numpy, geopy, openmeteo_requests, etc.)
  CLAUDE.md                    -- project instructions for Claude Code
```

There is only one route: "/" renders page.js, which contains the entire application.


## 4. How the App Works -- the Main Flow

```
Browser requests "/"
        |
        v
   layout.js  (sets metadata, loads Google Fonts, wraps in <body>)
        |
        v
   page.js  (mounts the app)
     /           |          \
    /            |           \
fetch            |           fetch
cities_all  maplibre       borders.geojson
  .json      init map          (once)
    \            |           /
     \    fetch climate_     /
      \   normals/{month}   /
       \  .json (lazy)     /
        \       |         /
         v      v        v
        deck.gl layers assembled
          Layer 1: SolidPolygonLayer  -- heatmap cells
          Layer 2: GeoJsonLayer       -- country borders
          Layer 3: ScatterplotLayer   -- city bubbles
                    |
                    v
        User interacts (hover, click, search, month slider)
                    |
              React state update
                    |
              affected layer rebuilt
                    |
              overlayRef.setProps() -> re-render
```

**Map initialization:** page.js creates a MapLibre map pointing to CartoDB Positron tile URL, adds a Deck.gl MapboxOverlay in interleaved mode, and boosts some CartoDB layer paint properties (border width, label opacity) so they stay legible over the colored heatmap.

**Layer management:** Rather than re-rendering all three layers together, each layer has its own useEffect that rebuilds only when its relevant state changes (climate data + variable for the heatmap; borders data for borders; cities + bubbleMetric for bubbles). After rebuilding, flushLayers() calls overlayRef.setProps() with all three layers in the correct z-order.

**Month lazy loading:** Climate data is fetched on demand when the user moves the month slider. A useRef cache (cache.current) holds already-fetched months so scrubbing back to January does not re-fetch. The initial mount fetches the current month (index 6, July) and cities_all.json simultaneously.

**City selection and compare:** Clicking a city bubble sets selectedCity state, which opens CityDetailPanel. Pinning up to two cities adds them to compareCities state; when two are pinned, CityDetailPanel switches its body from the tabbed detail view to ComparePanel, which shows 7 side-by-side bar metrics. The sparkline in ClimateTab fetches all 12 monthly climate files in parallel (via Promise.all) to build an annual temperature cycle; it uses its own module-level cache so navigating between cities does not re-fetch months already loaded.


## 5. Data Files

**web/public/data/climate_normals/climate_{month}.json** (12 files, ~1 MB each)
Each file contains the 1991-2020 WMO 30-year climate normals for one calendar month across a 153 x 281 grid covering Europe at 0.25-degree resolution. Structure:
```
{
  "month": 7,
  "lats": [72.0, 71.75, ...],   // 153 values, 72N to 34N
  "lons": [-25.0, -24.75, ...], // 281 values, -25W to 45E
  "temperature":   [[...], ...], // degrees C, null for ocean
  "precipitation": [[...], ...], // mm/month
  "sunshine":      [[...], ...]  // hours/day
}
```
Produced by scripts/process_era5.py from ERA5 NetCDF files (~4 GB, gitignored). Loaded lazily -- one file per month slider position, client-side cached.

**web/public/data/cities_all.json** (~140 KB)
One JSON array of 231 city objects. Each object contains:
- Identity: city, country, lat, lon
- Cost (13 Numbeo fields): cost-of-living-index, one-bedroom-city-rent, three-bedroom-city-rent, meal-restaurant, monthly-public-transport-pass, basic-utilities-85m2-apartment, cinema-ticket, price-square-meter-buy, 1l-milk, chicken, bread, rice
- Climate projections (8 fields): baseline_temp_c, future_temp_c, delta_temp_c, delta_summer_temp_c, delta_precip_pct, baseline_heat_days, future_heat_days, delta_heat_days
- Resilience (2 fields): resilience_score (0-100), risk_tier (Low Risk / Moderate Risk / High Risk / Critical)

Produced by running the three Pipeline B scripts in order. Loaded once on mount; the NaN->null replacement (JSON.parse(txt.replace(/NaN/g, "null"))) is needed because Python's json.dump emits literal NaN for missing floats, which is invalid JSON.

**web/public/data/borders.geojson**
Natural Earth boundary lines pre-clipped to the Europe bounding box. Used by the GeoJsonLayer to draw country borders above the heatmap but below city labels. Loaded once on mount.

**data/raw/cost-of-living.csv** (gitignored)
231 European cities with Numbeo cost-of-living metrics. The source of all cost fields and the city list. Never shipped to the browser; ingested only by build_city_dataset.py.

**data/raw/ERA5 NetCDF files** (gitignored, ~4 GB)
Two files from the Copernicus Climate Data Store: monthly averaged 2m temperature, and monthly accumulated precipitation plus surface solar radiation. Covers Jan 1940 - Dec 2025 globally at 0.25 degrees. Used only by process_era5.py.


## 6. State / Data Flow Summary

Raw ERA5 science data and Numbeo cost CSVs -> Python pipeline -> static JSON files -> fetched by browser on demand -> held in React state -> passed as props to Deck.gl layer constructors -> rendered to WebGL canvas.

| What | Where it lives | How it changes |
|---|---|---|
| Current month index (0-11) | useState in page.js | Month slider onChange |
| Selected heatmap variable | useState in page.js | Segmented control click |
| Selected bubble metric | useState in page.js | Dropdown select |
| Climate grid for current month | useState (climateData) in page.js | fetchMonth() on slider move or mount |
| Month fetch cache | useRef (cache.current) in page.js | Populated by fetchMonth(), never cleared |
| All 231 cities | useState (cities) in page.js | Fetched once on mount |
| Country borders GeoJSON | useState (borders) in page.js | Fetched once on mount |
| Hovered cell or bubble | useState (hoverInfo) in page.js | Deck.gl onHover callbacks |
| Selected city | useState (selectedCity) in page.js | Bubble click or CitySearch selection |
| Compared cities (0-2) | useState (compareCities) in page.js | Pin/unpin button in CityDetailPanel |
| Filter board expanded (mobile) | useState (filterExpanded) in page.js | Drag handle tap |
| Compare-slot search open | useState (addingCompareSlot) in page.js | "+ Add a city" button in FilterBoard |
| Sparkline temps (all 12 months) | useState in CityDetailPanel | Fetched on city change, module-level cache |
| Active detail tab | useState (tab) in CityDetailPanel | Tab button click |
| Deck.gl layer references | useRef (layersRef) in page.js | Individual layer useEffects rebuild one slot |
| Bubble metric min/max range | useMemo (bubbleRange) in page.js | Recomputed when cities or bubbleMetric changes |


## 7. Key Design Decisions

- **Fixed global color ranges across all months.** Temperature uses -15 to 35 C always, precipitation 0 to 200 mm, sunshine 0 to 14 h/day. An earlier version rescaled per month dynamically -- this made January look as red as July because the scale stretched to fill that month's narrower range, which was visually misleading. Fixed ranges let the user see seasonal contrast directly.

- **CELL_SIZE = 0.25 deg (full grid step, no gap).** An earlier version used a smaller cell size to leave visible gaps between cells. Now each cell fills exactly one grid step, eliminating seams. The heatmap alpha is reduced to 140/255 to preserve basemap bleed-through that the larger cells would otherwise cover completely.

- **Ocean cells stored as null and skipped at render time.** ERA5 temperature is null over ocean (no land-surface temperature). The cell-building loop in page.js skips null values, so no ocean cells are ever passed to SolidPolygonLayer. This avoids both rendering artifacts and unnecessary polygon geometry.

- **Three independent useEffects for the three map layers.** If all layers were rebuilt in a single effect, changing the month would also rebuild the city bubble layer (expensive, unnecessary). The layersRef stores the most recent instance of each layer; each effect updates only its slot and then calls flushLayers() to push all three to Deck.gl together.

- **NaN replacement before JSON.parse.** Python's standard json.dump writes NaN as the literal token NaN, which is not valid JSON. The browser fetch in page.js replaces it with null before parsing. This is a known Python/JavaScript interop gap.

- **Interleaved mode for Deck.gl layers.** Using MapboxOverlay with interleaved: true inserts Deck.gl layers into MapLibre's internal render pass rather than drawing them on a separate canvas on top. This lets the heatmap sit below MapLibre's own border and label layers -- city names and country borders stay readable. The trade-off is that each layer must specify a beforeId pointing to a MapLibre layer name.

- **Resilience score is relative, not absolute.** The score is min-max normalized across the current dataset of 231 cities. A city that scores 80 is among the most resilient in this dataset, not 80% safe in some absolute sense. Adding new cities shifts everyone's scores.

- **Flag images loaded from external CDN (flagcdn.com).** Country flags are not bundled -- they are fetched as WebP images from https://flagcdn.com at render time. Flag.js silently hides the img tag on error so missing flags do not break layout.

- **Sparkline fetches all 12 climate files in parallel.** CityDetailPanel uses Promise.all over all 12 MONTH_KEYS when a city is selected. This is faster than sequential fetching but triggers 12 concurrent HTTP requests. A module-level cache (climateCache, separate from the page-level cache) prevents re-fetching months already loaded.


## 8. Key Files Table

| File | Purpose |
|---|---|
| web/src/app/page.js | The entire app -- map init, all React state, all Deck.gl layers, event handlers |
| web/src/app/layout.js | HTML shell -- page metadata, Open Graph tags, Google Font loading |
| web/src/components/FilterBoard.js | Left control panel -- month slider, variable/metric selectors, city search, compare tray |
| web/src/components/CityDetailPanel.js | Right city panel -- Climate/Cost/Resilience tabs, sparkline, ring gauge, compare toggle |
| web/src/components/ComparePanel.js | City vs city bar chart -- 7 metrics with winner highlighting |
| web/src/components/CitySearch.js | Fuzzy search input with Fuse.js, keyboard navigation, dropdown |
| web/src/lib/colorScales.js | All color math -- heatmap multi-stop interpolation, bubble green-red scale, gradient CSS |
| web/src/lib/constants.js | MONTH_NAMES and MONTH_KEYS (single source of truth for month ordering) |
| web/src/lib/countryFlags.js | Country name to ISO 3166-1 alpha-2 lookup (for flagcdn.com URLs) |
| web/src/lib/gridUtils.js | nearestIdx / nearestGridValue -- snap a lat/lon to the nearest grid cell |
| web/public/data/cities_all.json | 231 cities with cost, climate projection, and resilience data |
| web/public/data/climate_normals/ | 12 monthly JSON files -- the heatmap source data |
| scripts/process_era5.py | Pipeline A -- converts ~4 GB ERA5 NetCDF files into 12 monthly JSON grids |
| scripts/build_city_dataset.py | Pipeline B step 3 -- merges all city inputs, computes resilience score |
| web/next.config.mjs | static export mode + deck.gl transpilation config |

**Where to look for any feature:**

- Change heatmap color scales -> web/src/lib/colorScales.js (TEMP_STOPS, PRECIP_STOPS, SUN_STOPS)
- Change fixed min/max ranges for heatmap -> web/src/app/page.js (VARIABLES constant near top)
- Add a new bubble metric -> web/src/app/page.js (BUBBLE_METRICS object) + web/src/components/FilterBoard.js (dropdown renders automatically)
- Add a new city detail stat -> web/src/components/CityDetailPanel.js (CostTab or ClimateTab function)
- Change resilience score formula -> scripts/build_city_dataset.py (STEP 2 block), then re-run the script
- Add a new city -> data/raw/cost-of-living.csv, then run geocode_cities.py -> fetch_projections.py -> build_city_dataset.py
- Change map center or zoom bounds -> web/src/app/page.js (Map constructor options)
- Mobile layout breakpoints -> web/src/components/FilterBoard.js and CityDetailPanel.js (sm: Tailwind prefix throughout)
