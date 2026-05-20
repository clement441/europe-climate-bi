# Function Map: European Climate & Living Costs BI Dashboard

> Generated: 2026-05-20 | Files scanned: 17 | Functions documented: 51

---

## Product Modules

| Module | Primary files | Responsibility |
|--------|---------------|----------------|
| App Shell & Map Orchestration | `web/src/app/page.js`, `web/src/app/layout.js` | Root layout, map initialisation, deck.gl layer lifecycle, global state, top-level event handlers |
| About Page | `web/src/app/about/page.js` | Static user-facing about page: plain-English app intro, navigation guide, data sources, author section |
| Color Scales & Legend | `web/src/lib/colorScales.js` | Per-variable color interpolation for heatmap cells and city bubbles, gradient CSS generation |
| Grid Utilities | `web/src/lib/gridUtils.js` | Nearest-neighbour lookup on the 0.25° climate grid |
| Formatting & Shared Utilities | `web/src/lib/utils.js`, `web/src/lib/constants.js`, `web/src/lib/countryFlags.js` | Metric display formatting, month name/key constants, ISO country-code lookup |
| Filter Board UI | `web/src/components/FilterBoard.js` | Left-side control panel: month slider, variable/bubble-metric selector, compare tray, city search embed |
| City Detail Panel | `web/src/components/CityDetailPanel.js` | Right-side slide-in panel with tabbed Climate / Cost / Resilience views, sparkline, ring gauge |
| City Comparison Panel | `web/src/components/ComparePanel.js` | Side-by-side metric comparison view with winner bars for two pinned cities |
| City Search | `web/src/components/CitySearch.js` | Fuzzy-search input with keyboard navigation and dropdown result list |
| Flag Widget | `web/src/components/Flag.js` | Country flag image rendered from flagcdn.com via ISO code lookup |
| ERA5 Climate Grid Pipeline | `scripts/process_era5.py` | Reads ERA5 NetCDF files, computes 1991-2020 climate normals, exports 12 monthly JSON files |
| City Geocoding Pipeline | `scripts/geocode_cities.py` | Resolves lat/lon for each city in the cost-of-living dataset via Nominatim |
| Climate Projections Pipeline | `scripts/fetch_projections.py` | Fetches 1991-2050 daily data from Open-Meteo, averages a 4-model ensemble, computes delta metrics |
| City Dataset Builder | `scripts/build_city_dataset.py` | Merges all inputs, computes resilience scores and risk tiers, writes `cities_all.json` |

---

## App Shell & Map Orchestration

> Owns the MapLibre GL map, the deck.gl overlay, all global React state, and the three layer-rebuild effects.

### `RootLayout`
**File:** `web/src/app/layout.js:47`
**Signature:** `RootLayout({ children }) -> JSX`
**Purpose:** Next.js App Router root layout. Loads Google Fonts and wraps every page in the styled `<body>` element.
**Inputs:**
- `children` (ReactNode) -- page content injected by the router
**Output:** HTML document shell with font CSS variables applied.
**Called by:** `[entry point]`
**Calls:** `[none]`

---

### `Home`
**File:** `web/src/app/page.js:65`
**Signature:** `Home() -> JSX`
**Purpose:** Single-page application root. Initialises the MapLibre map and deck.gl overlay, owns all app state (month, variable, city selection, compare list), and wires layer rebuild effects to state changes. Map init cleanup resets `mapRef`, `overlayRef`, and `layersRef` to null in addition to calling `map.remove()`.
**Inputs:** none (React component, driven by internal state)
**Output:** Full-page map with overlaid UI panels.
**Called by:** `[entry point]`
**Calls:** `fetchMonth`, `flushLayers`, `handleMonthChange`, `handleToggleCompare`, `handleCitySelect`, `formatMetric`, `getColor`, `bubbleColor`

---

### `fetchMonth`
**File:** `web/src/app/page.js:97`
**Signature:** `fetchMonth(monthIdx: number) -> void`
**Purpose:** Fetches the JSON climate-normals file for the given month index, using a module-level ref as a client-side cache to avoid re-fetching the same month.
**Inputs:**
- `monthIdx` (number) -- 0-based calendar month index
**Output:** void / side-effect (sets `climateData` and `loading` state)
**Called by:** `Home`, `handleMonthChange`
**Calls:** `[none]`

---

### `flushLayers`
**File:** `web/src/app/page.js:192`
**Signature:** `flushLayers() -> void`
**Purpose:** Pushes the current heatmap, borders, and city-bubble deck.gl layer references to the MapboxOverlay in the correct Z-order (heatmap → borders → bubbles).
**Inputs:** none (reads from `layersRef.current`)
**Output:** void / side-effect (updates deck.gl overlay props)
**Called by:** `Home`
**Calls:** `[none]`

---

### `handleMonthChange`
**File:** `web/src/app/page.js:332`
**Signature:** `handleMonthChange(e: ChangeEvent) -> void`
**Purpose:** Month slider `onChange` handler. Updates the month state and triggers a data fetch for the newly selected month.
**Inputs:**
- `e` (ChangeEvent) -- native range-input change event; `e.target.value` is the new month index
**Output:** void / side-effect
**Called by:** `[entry point]` (passed to `FilterBoard` as `onMonthChange` prop)
**Calls:** `fetchMonth`

---

### `handleToggleCompare`
**File:** `web/src/app/page.js:338`
**Signature:** `handleToggleCompare(city: object) -> void`
**Purpose:** Adds or removes a city from the compare list. Caps the list at two cities; toggling an already-pinned city removes it.
**Inputs:**
- `city` (object) -- city data object with `city` and `country` fields
**Output:** void / side-effect (updates `compareCities` state)
**Called by:** `[entry point]` (passed as `onToggleCompare` prop to `FilterBoard` and `CityDetailPanel`)
**Calls:** `[none]`

---

### `handleCitySelect`
**File:** `web/src/app/page.js:348`
**Signature:** `handleCitySelect(city: object) -> void`
**Purpose:** Selects a city for the detail panel and animates the map camera to fly to that city's coordinates.
**Inputs:**
- `city` (object) -- city data object with `lat`, `lon` fields
**Output:** void / side-effect (sets `selectedCity` state, calls `map.flyTo`)
**Called by:** `[entry point]` (passed as `onCitySelect` prop to `FilterBoard` and `CityDetailPanel`)
**Calls:** `[none]`

---

## About Page

> Static Next.js page at `/about`. No internal named functions — only module-level static data arrays and the default export component.

### `AboutPage`
**File:** `web/src/app/about/page.js:1`
**Signature:** `AboutPage() -> JSX`
**Purpose:** Renders the full-page About section with a plain-English introduction to the app, a numbered "How to use it" steps list, data-source attribution cards, and an author section with link pills. Provides a back-to-map `Link` in both the header and footer.
**Inputs:** none (static page, no props)
**Output:** Full-page static JSX document.
**Called by:** `[entry point]` (Next.js router renders at `/about`)
**Calls:** `Link`

---

## Color Scales & Legend

> Converts raw numeric climate and cost values into RGBA color arrays and CSS gradient strings for deck.gl layers and legend bars.

### `lerp`
**File:** `web/src/lib/colorScales.js:3`
**Signature:** `lerp(a: number[], b: number[], t: number) -> number[]`
**Purpose:** Linear interpolation between two RGB triplets at parameter `t`.
**Inputs:**
- `a` (number[]) -- RGB triplet for the start color
- `b` (number[]) -- RGB triplet for the end color
- `t` (number) -- blend factor in [0, 1]
**Output:** Interpolated `[R, G, B]` array with integer channels.
**Called by:** `multiStopColor`
**Calls:** `[none]`

---

### `multiStopColor`
**File:** `web/src/lib/colorScales.js:11`
**Signature:** `multiStopColor(ratio: number, stops: Array<{at: number, color: number[]}>) -> number[]`
**Purpose:** Maps a normalised ratio to an RGB color by finding the surrounding stop pair and interpolating between them.
**Inputs:**
- `ratio` (number) -- value in [0, 1] representing position on the color scale
- `stops` (object[]) -- ordered array of `{at, color}` stop objects
**Output:** `[R, G, B]` array.
**Called by:** `getColor`, `bubbleColor`
**Calls:** `lerp`

---

### `getColor`
**File:** `web/src/lib/colorScales.js:53`
**Signature:** `getColor(variable: string, value: number, min: number, max: number) -> number[]`
**Purpose:** Returns an `[R, G, B, A]` array for a heatmap cell, normalising the value against the variable's fixed global range and selecting the appropriate multi-stop scale.
**Inputs:**
- `variable` (string) -- one of `"temperature"`, `"precipitation"`, `"sunshine"`
- `value` (number) -- raw climate value in that variable's native unit
- `min` (number) -- fixed minimum of the color range
- `max` (number) -- fixed maximum of the color range
**Output:** `[R, G, B, 140]` RGBA array.
**Called by:** `Home`, `barProps`
**Calls:** `multiStopColor`

---

### `bubbleColor`
**File:** `web/src/lib/colorScales.js:68`
**Signature:** `bubbleColor(value: number|null, min: number, max: number, invert: boolean) -> number[]`
**Purpose:** Returns an `[R, G, B, A]` color for a city bubble using the green-to-red scale, optionally inverting the direction for metrics where lower is better.
**Inputs:**
- `value` (number|null) -- metric value; `null` produces grey
- `min` (number) -- dataset minimum for the selected metric
- `max` (number) -- dataset maximum for the selected metric
- `invert` (boolean) -- if true, high values map to green (e.g. resilience score)
**Output:** `[R, G, B, 220]` RGBA array.
**Called by:** `Home`
**Calls:** `multiStopColor`

---

### `stopsToGradient`
**File:** `web/src/lib/colorScales.js:77`
**Signature:** `stopsToGradient(stops: Array<{at: number, color: number[]}>) -> string`
**Purpose:** Converts a stop array into a CSS `linear-gradient(to right, ...)` string for use in legend bar styling.
**Inputs:**
- `stops` (object[]) -- ordered array of `{at, color}` stop objects
**Output:** CSS gradient string.
**Called by:** `FilterBoard`
**Calls:** `[none]`

---

## Grid Utilities

> Nearest-neighbour lookup utilities for mapping continuous lat/lon coordinates onto the discrete 0.25° ERA5 grid.

### `nearestIdx`
**File:** `web/src/lib/gridUtils.js:1`
**Signature:** `nearestIdx(arr: number[], val: number) -> number`
**Purpose:** Returns the index in `arr` whose value is closest to `val`. Used to snap city coordinates to the nearest grid cell.
**Inputs:**
- `arr` (number[]) -- sorted array of coordinate values (lats or lons)
- `val` (number) -- target coordinate to find
**Output:** Integer index.
**Called by:** `nearestGridValue`, `fetchSparklineTemps`
**Calls:** `[none]`

---

### `nearestGridValue`
**File:** `web/src/lib/gridUtils.js:5`
**Signature:** `nearestGridValue(climateData: object, lat: number, lon: number, variable: string) -> number|null`
**Purpose:** Looks up the climate value at the grid cell nearest to the given lat/lon for the requested variable in the currently loaded month's data.
**Inputs:**
- `climateData` (object) -- monthly climate JSON with `lats`, `lons`, and variable arrays
- `lat` (number) -- city latitude
- `lon` (number) -- city longitude
- `variable` (string) -- one of `"temperature"`, `"precipitation"`, `"sunshine"`
**Output:** The scalar value at the nearest grid cell, or `null` if unavailable.
**Called by:** `ComparePanel` (inside METRICS getValue callbacks)
**Calls:** `nearestIdx`

---

## Formatting & Shared Utilities

> Stateless helpers for displaying metric values, looking up country ISO codes, and shared month-name constants.

### `formatMetric`
**File:** `web/src/lib/utils.js:1`
**Signature:** `formatMetric(value: number|null, metric: object, decimals?: number) -> string`
**Purpose:** Formats a numeric metric value for display, applying the metric's unit prefix/suffix and returning `"N/A"` for null values.
**Inputs:**
- `value` (number|null) -- raw value to format
- `metric` (object) -- metric definition with `unit` and optional `unitPrefix` flag
- `decimals` (number, optional) -- decimal places; defaults to 1
**Output:** Human-readable formatted string (e.g. `"€1234.5"` or `"12.3%"`).
**Called by:** `Home`, `FilterBoard`
**Calls:** `[none]`

---

### `countryToISO`
**File:** `web/src/lib/countryFlags.js:19`
**Signature:** `countryToISO(name: string|null) -> string|null`
**Purpose:** Maps a country display name to its ISO 3166-1 alpha-2 code for use as a flagcdn.com path segment.
**Inputs:**
- `name` (string|null) -- country name as stored in the city dataset (e.g. `"Germany"`)
**Output:** Two-letter ISO code string, or `null` if not found.
**Called by:** `Flag`
**Calls:** `[none]`

---

## Filter Board UI

> The left-side frosted-glass control panel rendered on both desktop and mobile (bottom-sheet). Hosts the month slider, variable selector, bubble-metric selector, city search, and compare tray.

### `FilterBoard`
**File:** `web/src/components/FilterBoard.js:11`
**Signature:** `FilterBoard(props) -> JSX`
**Purpose:** Renders all map controls in a single scrollable panel. On mobile it collapses to a 72 px handle and slides up to 84 vh when expanded. Delegates search to `CitySearch` and compare chip rendering to `renderCompareSlot`.
**Inputs:**
- `month` (number) -- current month index (0–11)
- `onMonthChange` (function) -- month slider change handler
- `loading` (boolean) -- whether climate data is being fetched
- `error` (string|null) -- error message to display
- `variable` (string) -- active heatmap variable key
- `variables` (object) -- variable definitions map
- `onVariableChange` (function) -- variable selector change handler
- `bubbleMetric` (string) -- active bubble metric key
- `bubbleMetrics` (object) -- bubble metric definitions map
- `onBubbleMetricChange` (function) -- bubble metric selector change handler
- `bubbleRange` ({min, max}) -- data range for the active bubble metric
- `cities` (object[]|null) -- full city dataset
- `onCitySelect` (function) -- city selection callback
- `onViewCompare` (function) -- callback to open compare view for a city
- `compareCities` (object[]) -- list of up to two pinned cities
- `addingCompareSlot` (boolean) -- whether the compare search input is open
- `onAddingCompareSlotChange` (function) -- toggle for compare search mode
- `onToggleCompare` (function) -- pin/unpin a city in the compare list
- `selectedCity` (object|null) -- currently selected city
- `filterExpanded` (boolean) -- mobile sheet expansion state
- `onToggleExpanded` (function) -- mobile sheet toggle handler
**Output:** Rendered filter board panel.
**Called by:** `[entry point]` (rendered by `Home`)
**Calls:** `renderCompareSlot`, `stopsToGradient`, `formatMetric`, `CitySearch`, `Flag`, `Link`

---

### `renderCompareSlot`
**File:** `web/src/components/FilterBoard.js:40`
**Signature:** `renderCompareSlot(slotIdx: number) -> JSX|null`
**Purpose:** Renders one of the two compare-tray slots: shows a pinned city chip with a remove button if filled, an inline `CitySearch` if the slot is being actively filled, or a dashed "Add a city" button otherwise.
**Inputs:**
- `slotIdx` (number) -- 0 or 1 indicating which compare slot to render
**Output:** JSX element or `null`.
**Called by:** `FilterBoard`
**Calls:** `Flag`, `CitySearch`

---

## City Detail Panel

> Slide-in panel showing per-city detail across three tabs. Fetches sparkline temperature data asynchronously and delegates compare mode to `ComparePanel`.

### `CityDetailPanel`
**File:** `web/src/components/CityDetailPanel.js:164`
**Signature:** `CityDetailPanel({ city, onClose, compareCities, onToggleCompare, onCitySelect, climateData, month }) -> JSX|null`
**Purpose:** Renders the right-side city detail panel. Manages tab selection, fetches sparkline data on city change, and switches the body to `ComparePanel` when two cities are pinned.
**Inputs:**
- `city` (object|null) -- selected city; renders nothing if null
- `onClose` (function) -- close button handler
- `compareCities` (object[]) -- up to two pinned cities
- `onToggleCompare` (function) -- pin/unpin handler
- `onCitySelect` (function) -- navigate to a city from compare footer
- `climateData` (object|null) -- current month's grid data for live metrics
- `month` (number) -- active month index
**Output:** Aside element or `null`.
**Called by:** `[entry point]` (rendered by `Home`)
**Calls:** `fetchSparklineTemps`, `Flag`, `ComparePanel`, `ClimateTab`, `CostTab`, `ResilienceTab`

---

### `fetchSparklineTemps`
**File:** `web/src/components/CityDetailPanel.js:137`
**Signature:** `fetchSparklineTemps(lat: number, lon: number) -> Promise<(number|null)[]>`
**Purpose:** Fetches all 12 monthly climate-normal JSON files (using a module-level cache), then extracts the temperature at the nearest grid cell for each month to produce the sparkline data series.
**Inputs:**
- `lat` (number) -- city latitude
- `lon` (number) -- city longitude
**Output:** Promise resolving to a 12-element array of monthly temperature values (°C).
**Called by:** `CityDetailPanel`
**Calls:** `nearestIdx`

---

### `ClimateTab`
**File:** `web/src/components/CityDetailPanel.js:312`
**Signature:** `ClimateTab({ city, sparklineTemps, sparklineLoading }) -> JSX`
**Purpose:** Renders the Climate tab body: projected warming hero card, temperature sparkline, and detailed delta stats (summer temp, precipitation, heat days).
**Inputs:**
- `city` (object) -- city data with projection fields
- `sparklineTemps` (number[]|null) -- 12-month temperature array
- `sparklineLoading` (boolean) -- loading state for sparkline data
**Output:** JSX content for the Climate tab panel.
**Called by:** `CityDetailPanel`
**Calls:** `Sparkline`, `SectionLabel`, `Stat`, `fmtTemp`, `fmtSigned`, `fmtPct`

---

### `CostTab`
**File:** `web/src/components/CityDetailPanel.js:385`
**Signature:** `CostTab({ city }) -> JSX`
**Purpose:** Renders the Cost tab body showing housing, lifestyle, and grocery cost metrics for the city.
**Inputs:**
- `city` (object) -- city data with Numbeo cost-of-living fields
**Output:** JSX content for the Cost tab panel.
**Called by:** `CityDetailPanel`
**Calls:** `SectionLabel`, `Stat`, `fmtPrice`, `fmtNum`

---

### `ResilienceTab`
**File:** `web/src/components/CityDetailPanel.js:411`
**Signature:** `ResilienceTab({ city, risk }) -> JSX`
**Purpose:** Renders the Resilience tab body: an animated ring gauge showing the resilience score, risk tier badge, and a brief methodology note.
**Inputs:**
- `city` (object) -- city data with `resilience_score` and `risk_tier`
- `risk` (object) -- risk tier style object with color and CSS class fields
**Output:** JSX content for the Resilience tab panel.
**Called by:** `CityDetailPanel`
**Calls:** `RingGauge`, `Stat`

---

### `Sparkline`
**File:** `web/src/components/CityDetailPanel.js:57`
**Signature:** `Sparkline({ data, loading }) -> JSX`
**Purpose:** Renders a 12-month SVG line chart with an amber gradient fill and a peak dot. Shows a dashed placeholder while loading.
**Inputs:**
- `data` (number[]|null) -- 12 monthly temperature values
- `loading` (boolean) -- if true, shows loading placeholder
**Output:** SVG sparkline with month-initial axis labels.
**Called by:** `ClimateTab`
**Calls:** `[none]`

---

### `RingGauge`
**File:** `web/src/components/CityDetailPanel.js:100`
**Signature:** `RingGauge({ score, color }) -> JSX`
**Purpose:** Renders an SVG circular gauge that fills proportionally to the resilience score (0–100), with an animated stroke-dashoffset transition.
**Inputs:**
- `score` (number) -- resilience score 0–100
- `color` (string) -- CSS color string for the gauge arc
**Output:** 200×200 SVG ring gauge element.
**Called by:** `ResilienceTab`
**Calls:** `[none]`

---

### `Stat`
**File:** `web/src/components/CityDetailPanel.js:29`
**Signature:** `Stat({ label, value, accent }) -> JSX`
**Purpose:** Renders a single label-value row with a bottom border divider, used throughout the detail panel tabs.
**Inputs:**
- `label` (string) -- row label text
- `value` (string|null) -- formatted value; null renders "N/A" in muted style
- `accent` (string, optional) -- Tailwind text color class applied to the value
**Output:** JSX `<div>` row.
**Called by:** `ClimateTab`, `CostTab`, `ResilienceTab`
**Calls:** `[none]`

---

### `SectionLabel`
**File:** `web/src/components/CityDetailPanel.js:45`
**Signature:** `SectionLabel({ children }) -> JSX`
**Purpose:** Renders a small monospace section heading with a decorative hairline dash, used to group related stats.
**Inputs:**
- `children` (ReactNode) -- label text
**Output:** JSX heading element.
**Called by:** `ClimateTab`, `CostTab`
**Calls:** `[none]`

---

### `fmtPrice`
**File:** `web/src/components/CityDetailPanel.js:10`
**Signature:** `fmtPrice(v: number|null) -> string|null`
**Purpose:** Formats a numeric price as a euro string (e.g. `"€1234"`), returning `null` for missing values.
**Inputs:**
- `v` (number|null) -- price in euros
**Output:** Formatted string or `null`.
**Called by:** `CostTab`
**Calls:** `[none]`

---

### `fmtTemp`
**File:** `web/src/components/CityDetailPanel.js:11`
**Signature:** `fmtTemp(v: number|null) -> string|null`
**Purpose:** Formats a temperature value as `"X.X°C"`, returning `null` for missing values.
**Inputs:**
- `v` (number|null) -- temperature in Celsius
**Output:** Formatted string or `null`.
**Called by:** `ClimateTab`
**Calls:** `[none]`

---

### `fmtPct`
**File:** `web/src/components/CityDetailPanel.js:12`
**Signature:** `fmtPct(v: number|null) -> string|null`
**Purpose:** Formats a percentage value with explicit sign (e.g. `"+3.2%"` or `"-1.0%"`), returning `null` for missing values.
**Inputs:**
- `v` (number|null) -- percentage value
**Output:** Formatted string or `null`.
**Called by:** `ClimateTab`
**Calls:** `[none]`

---

### `fmtNum`
**File:** `web/src/components/CityDetailPanel.js:13`
**Signature:** `fmtNum(v: number|null, dec?: number) -> string|null`
**Purpose:** Formats a number to a fixed number of decimal places, returning `null` for missing values.
**Inputs:**
- `v` (number|null) -- numeric value
- `dec` (number, optional) -- decimal places; defaults to 1
**Output:** Formatted string or `null`.
**Called by:** `CostTab`
**Calls:** `[none]`

---

### `fmtSigned`
**File:** `web/src/components/CityDetailPanel.js:14`
**Signature:** `fmtSigned(v: number|null, dec: number, unit: string) -> string|null`
**Purpose:** Formats a value with an explicit sign prefix and a unit suffix (e.g. `"+1.5°C"`), returning `null` for missing values.
**Inputs:**
- `v` (number|null) -- numeric value
- `dec` (number) -- decimal places
- `unit` (string) -- unit suffix
**Output:** Formatted string or `null`.
**Called by:** `ClimateTab`
**Calls:** `[none]`

---

## City Comparison Panel

> Renders the two-city comparison view inside the detail panel, with per-metric horizontal bars and a navigation footer.

### `ComparePanel`
**File:** `web/src/components/ComparePanel.js:154`
**Signature:** `ComparePanel({ cities, onRemove, onCityClick, climateData, month }) -> JSX`
**Purpose:** Renders the full side-by-side comparison view for two pinned cities across 7 metrics (4 socioeconomic, 3 live climate). Delegates each metric row to `MetricSection`.
**Inputs:**
- `cities` (object[]) -- array of exactly two city objects
- `onRemove` (function) -- callback to unpin a city
- `onCityClick` (function) -- callback to navigate to a city's detail view
- `climateData` (object|null) -- current month's grid data for live temperature/precip/sun
- `month` (number) -- active month index for the section label
**Output:** Scrollable panel with metric rows and a sticky footer.
**Called by:** `CityDetailPanel`
**Calls:** `MetricSection`, `Flag`, `nearestGridValue`

---

### `MetricSection`
**File:** `web/src/components/ComparePanel.js:98`
**Signature:** `MetricSection({ metric, cityA, cityB, climateData }) -> JSX`
**Purpose:** Renders a centered metric label and two `CityBarRow` entries for a single comparison metric.
**Inputs:**
- `metric` (object) -- metric definition with `label`, `sublabel`, `getValue`, `invert`, `showWinner`, `format`, and optional `absoluteColor`
- `cityA` (object) -- first city data object
- `cityB` (object) -- second city data object
- `climateData` (object|null) -- grid data passed through for live climate metrics
**Output:** JSX metric section block.
**Called by:** `ComparePanel`
**Calls:** `CityBarRow`, `barProps`

---

### `CityBarRow`
**File:** `web/src/components/ComparePanel.js:126`
**Signature:** `CityBarRow({ city, bar, formatted }) -> JSX`
**Purpose:** Renders one row of the comparison: city name with flag, a horizontal proportion bar colored by winner status or climate scale, and the formatted value.
**Inputs:**
- `city` (object) -- city data object
- `bar` ({color: string, pct: number}) -- bar color and width percentage
- `formatted` (string) -- pre-formatted metric value string
**Output:** JSX row element.
**Called by:** `MetricSection`
**Calls:** `Flag`

---

### `barProps`
**File:** `web/src/components/ComparePanel.js:78`
**Signature:** `barProps(value, otherValue, invert, showWinner, absoluteColor) -> {color: string, pct: number}`
**Purpose:** Computes the bar color and proportional width for one city in a comparison row. Climate metrics use the heatmap color scale; cost/resilience metrics highlight the winner in emerald.
**Inputs:**
- `value` (number|null) -- this city's metric value
- `otherValue` (number|null) -- the other city's metric value
- `invert` (boolean) -- whether lower is better
- `showWinner` (boolean) -- whether to highlight the winner at all
- `absoluteColor` (object|null) -- if set, use heatmap scale with `{variable, min, max}`
**Output:** `{color, pct}` object.
**Called by:** `MetricSection`
**Calls:** `getColor`

---

## City Search

> Fuzzy-search text input backed by Fuse.js, with keyboard navigation and an accessible dropdown result list.

### `CitySearch`
**File:** `web/src/components/CitySearch.js:19`
**Signature:** `CitySearch({ cities, onSelect, hideLabel?, placeholder?, excludeCities?, autoFocus? }) -> JSX`
**Purpose:** Provides a fuzzy city search with keyboard (arrow keys, Enter, Escape) and mouse navigation. Excludes already-pinned cities when used inside the compare tray.
**Inputs:**
- `cities` (object[]|null) -- full city dataset used to build the Fuse index
- `onSelect` (function) -- callback invoked with the chosen city object
- `hideLabel` (boolean, optional) -- suppress the "Locate" section label
- `placeholder` (string, optional) -- input placeholder text
- `excludeCities` (object[], optional) -- cities to omit from search results
- `autoFocus` (boolean, optional) -- auto-focus the input on mount
**Output:** Search input with a conditional dropdown.
**Called by:** `FilterBoard`, `renderCompareSlot`
**Calls:** `commit`, `handleKey`, `ResultRow`, `EmptyState`, `Flag`

---

### `commit`
**File:** `web/src/components/CitySearch.js:71`
**Signature:** `commit(city: object) -> void`
**Purpose:** Finalises a city selection: invokes the `onSelect` callback, clears the query, closes the dropdown, and blurs the input.
**Inputs:**
- `city` (object) -- the selected city data object
**Output:** void / side-effect
**Called by:** `CitySearch`, `handleKey`
**Calls:** `[none]`

---

### `handleKey`
**File:** `web/src/components/CitySearch.js:80`
**Signature:** `handleKey(e: KeyboardEvent) -> void`
**Purpose:** Handles keyboard navigation in the search dropdown: ArrowDown/Up cycle the active result, Enter commits the selection, and Escape closes the dropdown.
**Inputs:**
- `e` (KeyboardEvent) -- keyboard event from the search input
**Output:** void / side-effect
**Called by:** `CitySearch`
**Calls:** `commit`

---

### `ResultRow`
**File:** `web/src/components/CitySearch.js:177`
**Signature:** `ResultRow({ city, active, onHover, onSelect }) -> JSX`
**Purpose:** Renders a single search result list item with a country flag, city name, and an amber active indicator.
**Inputs:**
- `city` (object) -- city data object
- `active` (boolean) -- whether this row is keyboard-highlighted
- `onHover` (function) -- mouse-enter handler to update active index
- `onSelect` (function) -- click handler to select this result
**Output:** `<li>` element with a `<button>` inside.
**Called by:** `CitySearch`
**Calls:** `Flag`

---

### `EmptyState`
**File:** `web/src/components/CitySearch.js:224`
**Signature:** `EmptyState() -> JSX`
**Purpose:** Renders the "No matches / Try a different spelling" placeholder inside the dropdown when Fuse returns no results.
**Inputs:** none
**Output:** Centered no-results message.
**Called by:** `CitySearch`
**Calls:** `[none]`

---

## Flag Widget

> Renders a country flag image from flagcdn.com, silently hiding itself if the country is unrecognised.

### `Flag`
**File:** `web/src/components/Flag.js:5`
**Signature:** `Flag({ country, size?, className?, alt? }) -> JSX|null`
**Purpose:** Resolves a country name to an ISO code, then renders a `<img>` pointing to flagcdn.com. Returns `null` if the country cannot be resolved; hides itself on image load error.
**Inputs:**
- `country` (string|undefined) -- display country name
- `size` (string, optional) -- flagcdn size code, e.g. `"w20"` or `"w40"`
- `className` (string, optional) -- Tailwind classes for the `<img>` element
- `alt` (string, optional) -- alt text for the image
**Output:** `<img>` element or `null`.
**Called by:** `FilterBoard`, `renderCompareSlot`, `CityDetailPanel`, `ComparePanel`, `CityBarRow`, `ResultRow`
**Calls:** `countryToISO`

---

## ERA5 Climate Grid Pipeline

> Standalone Python script (Pipeline A). Reads two large ERA5 NetCDF files, slices to Europe, converts units, estimates sunshine via Ångström-Prescott, computes 30-year normals, and exports 12 monthly JSON files.

> Note: `process_era5.py` is implemented as a linear top-level script with no named functions. The processing steps (load, reproject, convert units, compute sunshine, compute normals, export) are documented here as the script's overall entry point.

### `process_era5` (script entry point)
**File:** `scripts/process_era5.py:1`
**Signature:** `process_era5 [no callable — top-level script]`
**Purpose:** End-to-end ERA5 processing: loads raw NetCDF files, reprojects longitude, slices to the European bounding box (72°N–34°N, 25°W–45°E), converts temperature to Celsius and precipitation to mm/month, computes sunshine hours via vectorised Ångström-Prescott, calculates 1991-2020 WMO monthly normals, and writes 12 JSON files plus a metadata file to `data/processed/climate_normals/` and mirrors them to `web/public/data/climate_normals/`.
**Inputs:** ERA5 NetCDF files in `data/raw/`
**Output:** 12 monthly JSON files + `metadata.json` written to disk.
**Called by:** `[entry point]`
**Calls:** `[none]`

---

## City Geocoding Pipeline

> Standalone Python script (Pipeline B, step 1). Resolves lat/lon for every city in the cost-of-living CSV using the Nominatim geocoder, writing results incrementally to `cities_master.csv`.

> Note: `geocode_cities.py` is implemented as a linear top-level script with no named functions.

### `geocode_cities` (script entry point)
**File:** `scripts/geocode_cities.py:1`
**Signature:** `geocode_cities [no callable — top-level script]`
**Purpose:** Loads `cost-of-living.csv`, diffs against any existing `cities_master.csv`, geocodes only new cities via Nominatim (1 s rate-limit delay per request), and writes the merged result back to `data/processed/cities_master.csv`.
**Inputs:** `data/raw/cost-of-living.csv`, optional `data/processed/cities_master.csv`
**Output:** Updated `data/processed/cities_master.csv` with `city`, `country`, `lat`, `lon` columns.
**Called by:** `[entry point]`
**Calls:** `[none]`

---

## Climate Projections Pipeline

> Standalone Python script (Pipeline B, step 2). Fetches 60 years of daily data from the Open-Meteo Climate API for each city, averages a 4-model GCM ensemble, and computes delta metrics.

### `compute_city_projections`
**File:** `scripts/fetch_projections.py:146`
**Signature:** `compute_city_projections(city_responses: list, row: pd.Series) -> dict`
**Purpose:** Processes the four model API responses for one city: builds per-model DataFrames, computes ensemble means, then calculates annual temperature delta, summer temperature delta, precipitation percentage change, and extreme-heat-day counts for baseline (1991-2020) vs future (2040-2050) periods.
**Inputs:**
- `city_responses` (list) -- list of 4 Open-Meteo response objects (one per GCM)
- `row` (pd.Series) -- city record with `city`, `country`, `lat`, `lon`
**Output:** Dict with 12 fields: identity columns plus `baseline_temp_c`, `future_temp_c`, `delta_temp_c`, `delta_summer_temp_c`, `delta_precip_pct`, `baseline_heat_days`, `future_heat_days`, `delta_heat_days`.
**Called by:** `[entry point]` (called in a loop from the fetch_projections script body)
**Calls:** `[none]`

---

### `fetch_projections` (script entry point)
**File:** `scripts/fetch_projections.py:1`
**Signature:** `fetch_projections [no callable — top-level script]`
**Purpose:** Loads `cities_master.csv`, diffs against existing `climate_projections.csv`, makes a batch Open-Meteo API call for all missing cities across 4 GCMs, and iterates `compute_city_projections` to build the projections CSV.
**Inputs:** `data/processed/cities_master.csv`, optional `data/processed/climate_projections.csv`
**Output:** Updated `data/processed/climate_projections.csv`.
**Called by:** `[entry point]`
**Calls:** `compute_city_projections`

---

## City Dataset Builder

> Standalone Python script (Pipeline B, step 3). Merges all three data sources, computes a relative resilience score, assigns risk tiers, and writes `cities_all.json`.

### `minmax`
**File:** `scripts/build_city_dataset.py:104`
**Signature:** `minmax(series: pd.Series) -> pd.Series`
**Purpose:** Min-max normalises a pandas Series to the 0–100 range, producing a vulnerability sub-score where 0 is least vulnerable and 100 is most vulnerable.
**Inputs:**
- `series` (pd.Series) -- raw delta metric values across all cities
**Output:** Normalised Series in [0, 100], or a zero-filled Series if all values are equal.
**Called by:** `[entry point]` (called directly from the build_city_dataset script body)
**Calls:** `[none]`

---

### `risk_tier`
**File:** `scripts/build_city_dataset.py:118`
**Signature:** `risk_tier(score: float) -> str`
**Purpose:** Maps a resilience score to a categorical risk tier string using fixed thresholds (≥75 Low Risk, ≥50 Moderate Risk, ≥25 High Risk, <25 Critical).
**Inputs:**
- `score` (float) -- resilience score in [0, 100]
**Output:** One of `"Low Risk"`, `"Moderate Risk"`, `"High Risk"`, `"Critical"`.
**Called by:** `[entry point]` (applied via `df["resilience_score"].apply(risk_tier)`)
**Calls:** `[none]`

---

### `build_city_dataset` (script entry point)
**File:** `scripts/build_city_dataset.py:1`
**Signature:** `build_city_dataset [no callable — top-level script]`
**Purpose:** Loads `cost-of-living.csv`, `cities_master.csv`, and `climate_projections.csv`; computes resilience scores and risk tiers using `minmax` and `risk_tier`; merges all data; and writes compact JSON to both `data/processed/cities_all.json` and `web/public/data/cities_all.json`.
**Inputs:** Three CSV files from `data/raw/` and `data/processed/`
**Output:** `cities_all.json` written to two locations.
**Called by:** `[entry point]`
**Calls:** `minmax`, `risk_tier`
