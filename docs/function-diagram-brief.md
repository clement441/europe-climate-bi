# Diagram Brief: Function Call Graph — European Climate & Living Costs Dashboard

**Layout**: grouped (one swim lane per module; callers above callees within each lane)
**Flow summary**: Shows how 50 functions across 13 modules call each other, anchored by the `Home` orchestrator at the top, the shared `Flag` / color / grid utilities at the bottom, and the four Python pipeline scripts in a separate section.

---

## Elements

Create a group labeled "App Shell & Map Orchestration" that contains: RootLayout, Home, fetchMonth, flushLayers, handleMonthChange, handleToggleCompare, handleCitySelect.

Create a group labeled "Color Scales & Legend" that contains: getColor, bubbleColor, stopsToGradient, multiStopColor, lerp.

Create a group labeled "Grid Utilities" that contains: nearestGridValue, nearestIdx.

Create a group labeled "Formatting & Shared Utilities" that contains: formatMetric, countryToISO.

Create a group labeled "Filter Board UI" that contains: FilterBoard, renderCompareSlot.

Create a group labeled "City Detail Panel" that contains: CityDetailPanel, fetchSparklineTemps, ClimateTab, CostTab, ResilienceTab, Sparkline, RingGauge, Stat, SectionLabel, fmtTemp, fmtSigned, fmtPct, fmtPrice, fmtNum.

Create a group labeled "City Comparison Panel" that contains: ComparePanel, MetricSection, barProps, CityBarRow.

Create a group labeled "City Search" that contains: CitySearch, handleKey, commit, ResultRow, EmptyState.

Create a group labeled "Flag Widget" that contains: Flag.

Create a group labeled "ERA5 Climate Grid Pipeline (Python)" that contains: process_era5.

Create a group labeled "City Geocoding Pipeline (Python)" that contains: geocode_cities.

Create a group labeled "Climate Projections Pipeline (Python)" that contains: fetch_projections, compute_city_projections.

Create a group labeled "City Dataset Builder (Python)" that contains: build_city_dataset, minmax, risk_tier.

Create a box labeled "RootLayout". Note: Next.js App Router root layout; wraps all pages in the styled body with font CSS variables. File: web/src/app/layout.js:47.

Create a box labeled "Home". Note: [hub] Single-page app root — initialises MapLibre map, deck.gl overlay, owns all React state, wires three independent layer-rebuild effects. File: web/src/app/page.js:65.

Create a box labeled "fetchMonth". Note: Fetches one month's climate JSON file; uses a useRef cache to skip re-fetches. File: web/src/app/page.js:97.

Create a box labeled "flushLayers". Note: Pushes heatmap → borders → bubbles layers to the deck.gl MapboxOverlay in Z-order. File: web/src/app/page.js:192.

Create a box labeled "handleMonthChange". Note: Month slider onChange handler; delegates to fetchMonth. File: web/src/app/page.js:332.

Create a box labeled "handleToggleCompare". Note: Adds/removes a city from the compare list (capped at 2). File: web/src/app/page.js:338.

Create a box labeled "handleCitySelect". Note: Sets selectedCity state and calls map.flyTo for the chosen city. File: web/src/app/page.js:348.

Create a box labeled "getColor". Note: [hub] Returns RGBA for a heatmap cell given variable + value + fixed range. File: web/src/lib/colorScales.js:53.

Create a box labeled "bubbleColor". Note: Returns RGBA for a city bubble; supports invert flag for metrics where lower is better. File: web/src/lib/colorScales.js:68.

Create a box labeled "stopsToGradient". Note: Converts a stop array to a CSS linear-gradient string for legend bars. File: web/src/lib/colorScales.js:77.

Create a box labeled "multiStopColor". Note: Maps a normalised ratio to RGB by interpolating between the surrounding stop pair. File: web/src/lib/colorScales.js:11.

Create a box labeled "lerp". Note: Linear interpolation between two RGB triplets. File: web/src/lib/colorScales.js:3.

Create a box labeled "nearestGridValue". Note: Looks up the climate value at the grid cell nearest to a given lat/lon. File: web/src/lib/gridUtils.js:5.

Create a box labeled "nearestIdx". Note: Finds the index in a coordinate array closest to a target value. File: web/src/lib/gridUtils.js:1.

Create a box labeled "formatMetric". Note: Formats a numeric value with its unit prefix/suffix; returns "N/A" for null. File: web/src/lib/utils.js:1.

Create a box labeled "countryToISO". Note: Maps a country display name to its ISO 3166-1 alpha-2 code for flagcdn.com URLs. File: web/src/lib/countryFlags.js:19.

Create a box labeled "FilterBoard". Note: [hub] Left-side control panel — month slider, variable/metric selectors, compare tray, embedded CitySearch. File: web/src/components/FilterBoard.js:11.

Create a box labeled "renderCompareSlot". Note: Renders one compare-tray slot: pinned city chip, inline CitySearch, or dashed "Add" button. File: web/src/components/FilterBoard.js:40.

Create a box labeled "CityDetailPanel". Note: [hub] Right-side slide-in panel; manages tab state, fetches sparkline data, switches to ComparePanel when 2 cities are pinned. File: web/src/components/CityDetailPanel.js:164.

Create a box labeled "fetchSparklineTemps". Note: Fetches all 12 monthly climate files in parallel (module-level cache); extracts nearest-grid temperature for sparkline. File: web/src/components/CityDetailPanel.js:137.

Create a box labeled "ClimateTab". Note: Climate tab body — projected warming hero card, sparkline, delta stats. File: web/src/components/CityDetailPanel.js:312.

Create a box labeled "CostTab". Note: Cost tab body — housing, lifestyle, grocery cost rows. File: web/src/components/CityDetailPanel.js:385.

Create a box labeled "ResilienceTab". Note: Resilience tab body — animated ring gauge, risk tier badge, methodology note. File: web/src/components/CityDetailPanel.js:411.

Create a box labeled "Sparkline". Note: 12-month SVG line chart with amber gradient fill; shows dashed placeholder while loading. File: web/src/components/CityDetailPanel.js:57.

Create a box labeled "RingGauge". Note: SVG circular gauge that fills proportionally to resilience score with animated stroke. File: web/src/components/CityDetailPanel.js:100.

Create a box labeled "Stat". Note: Single label-value display row used throughout all tab bodies. File: web/src/components/CityDetailPanel.js:29.

Create a box labeled "SectionLabel". Note: Small monospace section heading with decorative hairline dash. File: web/src/components/CityDetailPanel.js:45.

Create a box labeled "fmtTemp". Note: Formats temperature as "X.X°C". File: web/src/components/CityDetailPanel.js:11.

Create a box labeled "fmtSigned". Note: Formats a value with explicit sign and unit suffix (e.g. "+1.5°C"). File: web/src/components/CityDetailPanel.js:14.

Create a box labeled "fmtPct". Note: Formats a percentage with explicit sign (e.g. "+3.2%"). File: web/src/components/CityDetailPanel.js:12.

Create a box labeled "fmtPrice". Note: Formats a price as a euro string (e.g. "€1234"). File: web/src/components/CityDetailPanel.js:10.

Create a box labeled "fmtNum". Note: Formats a number to fixed decimal places. File: web/src/components/CityDetailPanel.js:13.

Create a box labeled "ComparePanel". Note: [hub] Side-by-side metric comparison for two pinned cities across 7 metrics. File: web/src/components/ComparePanel.js:154.

Create a box labeled "MetricSection". Note: Renders a metric label and two CityBarRow entries for one comparison metric. File: web/src/components/ComparePanel.js:98.

Create a box labeled "barProps". Note: Computes bar color and proportional width — uses heatmap scale for climate metrics, emerald/slate for cost/resilience. File: web/src/components/ComparePanel.js:78.

Create a box labeled "CityBarRow". Note: One comparison row: city name + flag, proportion bar, formatted value. File: web/src/components/ComparePanel.js:126.

Create a box labeled "CitySearch". Note: [hub] Fuzzy Fuse.js search input with keyboard nav (↑/↓/Enter/Esc) and a dropdown result list. File: web/src/components/CitySearch.js:19.

Create a box labeled "handleKey". Note: Keyboard navigation handler — arrows cycle active result, Enter commits, Escape closes. File: web/src/components/CitySearch.js:80.

Create a box labeled "commit". Note: Finalises a city selection — invokes onSelect, clears query, closes dropdown. File: web/src/components/CitySearch.js:71.

Create a box labeled "ResultRow". Note: Single search result list item with flag, city name, amber active indicator. File: web/src/components/CitySearch.js:177.

Create a box labeled "EmptyState". Note: "No matches" placeholder shown when Fuse returns no results. File: web/src/components/CitySearch.js:224.

Create a box labeled "Flag". Note: [hub] Resolves country name → ISO code → flagcdn.com img tag; returns null on unknown country; hides on load error. File: web/src/components/Flag.js:5.

Create a box labeled "process_era5". Note: Top-level script. Loads ERA5 NetCDF files, computes 1991-2020 WMO climate normals, exports 12 monthly JSON files to data/processed/ and web/public/data/. File: scripts/process_era5.py:1.

Create a box labeled "geocode_cities". Note: Top-level script. Resolves lat/lon for each city via Nominatim (1 req/sec), writes cities_master.csv incrementally. File: scripts/geocode_cities.py:1.

Create a box labeled "fetch_projections". Note: Top-level script. Batch-fetches 1991-2050 daily climate data across 4 GCMs from Open-Meteo; iterates compute_city_projections per city. File: scripts/fetch_projections.py:1.

Create a box labeled "compute_city_projections". Note: Processes 4 model responses for one city into ensemble-mean deltas (temp, summer temp, precip %, heat days). File: scripts/fetch_projections.py:146.

Create a box labeled "build_city_dataset". Note: Top-level script. Merges all three input CSVs; calls minmax and risk_tier; writes cities_all.json to two locations. File: scripts/build_city_dataset.py:1.

Create a box labeled "minmax". Note: Min-max normalises a pandas Series to [0, 100] for a vulnerability sub-score. File: scripts/build_city_dataset.py:104.

Create a box labeled "risk_tier". Note: Maps a resilience score to "Low / Moderate / High Risk / Critical" using fixed thresholds. File: scripts/build_city_dataset.py:118.

Draw an arrow from Home to fetchMonth. Label it "on mount + month slider change".

Draw an arrow from Home to flushLayers. Label it "after each layer-rebuild effect".

Draw an arrow from Home to FilterBoard. Label it "renders with state props + handler callbacks".

Draw an arrow from Home to CityDetailPanel. Label it "renders with selectedCity, climateData, compareCities".

Draw an arrow from Home to getColor. Label it "colors each heatmap cell".

Draw an arrow from Home to bubbleColor. Label it "colors each city bubble".

Draw an arrow from Home to formatMetric. Label it "formats hover tooltip values".

Draw an arrow from handleMonthChange to fetchMonth. Label it "triggers data fetch on slider change".

Draw an arrow from multiStopColor to lerp. Label it "interpolates between two adjacent stops".

Draw an arrow from getColor to multiStopColor. Label it "delegates normalised ratio".

Draw an arrow from bubbleColor to multiStopColor. Label it "delegates normalised ratio".

Draw an arrow from nearestGridValue to nearestIdx. Label it "snaps lat and lon to grid indices".

Draw an arrow from FilterBoard to renderCompareSlot. Label it "renders slot 0 and slot 1 of compare tray".

Draw an arrow from FilterBoard to stopsToGradient. Label it "builds legend gradient CSS".

Draw an arrow from FilterBoard to formatMetric. Label it "formats bubble metric range labels".

Draw an arrow from FilterBoard to CitySearch. Label it "embeds search in locate section".

Draw an arrow from FilterBoard to Flag. Label it "renders flag in pinned city chips".

Draw an arrow from renderCompareSlot to CitySearch. Label it "embeds inline search when slot is being filled".

Draw an arrow from renderCompareSlot to Flag. Label it "renders flag in filled slot chip".

Draw an arrow from CityDetailPanel to fetchSparklineTemps. Label it "fetches on city change".

Draw an arrow from CityDetailPanel to ClimateTab. Label it "renders when tab === 'climate'".

Draw an arrow from CityDetailPanel to CostTab. Label it "renders when tab === 'cost'".

Draw an arrow from CityDetailPanel to ResilienceTab. Label it "renders when tab === 'resilience'".

Draw an arrow from CityDetailPanel to ComparePanel. Label it "renders instead of tabs when 2 cities pinned".

Draw an arrow from CityDetailPanel to Flag. Label it "renders flag in panel header".

Draw an arrow from fetchSparklineTemps to nearestIdx. Label it "snaps city lat/lon to climate grid cell".

Draw an arrow from ClimateTab to Sparkline. Label it "passes 12-month temperature array".

Draw an arrow from ClimateTab to SectionLabel. Label it "section headings".

Draw an arrow from ClimateTab to Stat. Label it "delta stats rows".

Draw an arrow from ClimateTab to fmtTemp.

Draw an arrow from ClimateTab to fmtSigned.

Draw an arrow from ClimateTab to fmtPct.

Draw an arrow from CostTab to SectionLabel.

Draw an arrow from CostTab to Stat.

Draw an arrow from CostTab to fmtPrice.

Draw an arrow from CostTab to fmtNum.

Draw an arrow from ResilienceTab to RingGauge. Label it "passes resilience score + color".

Draw an arrow from ResilienceTab to Stat.

Draw an arrow from ComparePanel to MetricSection. Label it "renders 7 metric sections".

Draw an arrow from ComparePanel to nearestGridValue. Label it "getValue callbacks for live climate metrics".

Draw an arrow from ComparePanel to Flag. Label it "renders flags in footer city chips".

Draw an arrow from MetricSection to barProps. Label it "computes bar color + width for each city".

Draw an arrow from MetricSection to CityBarRow. Label it "renders bar row for each city".

Draw an arrow from barProps to getColor. Label it "uses heatmap color scale for climate metrics".

Draw an arrow from CityBarRow to Flag. Label it "renders city flag".

Draw an arrow from CitySearch to handleKey. Label it "keyboard event handler on input".

Draw an arrow from CitySearch to commit. Label it "selection finaliser".

Draw an arrow from CitySearch to ResultRow. Label it "renders each match in dropdown".

Draw an arrow from CitySearch to EmptyState. Label it "renders when Fuse returns no results".

Draw an arrow from CitySearch to Flag. Label it "via ResultRow — flag in each result item".

Draw an arrow from handleKey to commit. Label it "on Enter keypress".

Draw an arrow from ResultRow to Flag. Label it "country flag beside city name".

Draw an arrow from Flag to countryToISO. Label it "resolves country name to ISO code".

Draw an arrow from fetch_projections to compute_city_projections. Label it "one call per city in the batch loop".

Draw an arrow from build_city_dataset to minmax. Label it "normalises 4 vulnerability sub-scores".

Draw an arrow from build_city_dataset to risk_tier. Label it "applied via df.apply() to assign tiers".

Mark Home as entry point.

Mark RootLayout as entry point.

Mark process_era5 as entry point.

Mark geocode_cities as entry point.

Mark fetch_projections as entry point.

Mark build_city_dataset as entry point.

Add a note to Home: "Three independent useEffects rebuild only the changed layer slot; all three layer refs are flushed together via flushLayers() after each rebuild to preserve Z-order."

Add a note to Flag: "Called by 6 different components (FilterBoard, renderCompareSlot, CityDetailPanel, ComparePanel, CityBarRow, ResultRow) — the most widely shared UI primitive in the codebase."

Add a note to getColor: "Also used by barProps in ComparePanel for climate-metric bars, keeping the compare view colour-consistent with the heatmap."

Add a note to fetchSparklineTemps: "Uses a separate module-level cache (climateCache) from the page-level useRef cache in fetchMonth — both avoid re-fetching, but they are independent objects."

---

## Notes

- **Python pipelines are not connected to the JS modules** in this diagram — they produce the static JSON files that page.js fetches at runtime. Add a connecting note or border if you want to show the hand-off point.
- **fmt* helper functions** (fmtTemp, fmtSigned, fmtPct, fmtPrice, fmtNum) are leaf nodes with no callees; they can be shown as smaller boxes or collapsed into a single "formatters" annotation inside City Detail Panel if the diagram becomes too crowded.
- **MONTH_NAMES / MONTH_KEYS constants** in constants.js are imported directly (not via a function call) by several modules; they are not shown as function boxes here but could be represented as a shared config node if desired.
- **Fuse.js** (fuzzy search library) is used inside CitySearch but not drawn as a separate box — it is an internal dependency, not a module in this codebase.
