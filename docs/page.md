# `web/src/app/page.js` — lite docs

The single-page entry point for the dashboard. One client component (`Home`) owns all state and mounts MapLibre + deck.gl. Everything else in the file is either a pure helper or a small presentational sub-component.

- **Path:** `web/src/app/page.js`
- **Type:** Next.js App Router page, marked `"use client"`
- **Renders:** full-screen map + floating controls + hover tooltip + slide-in city detail panel

---

## File map

| Section (lines) | What's there |
|---|---|
| 1–7 | Imports — React hooks, MapLibre, deck.gl Mapbox overlay, two deck.gl layer classes |
| 9–20 | Constants — `CELL_SIZE` (0.21°), month names/keys |
| 22–64 | `VARIABLES` and `BUBBLE_METRICS` config tables — labels, units, fixed color ranges, accessors |
| 66–128 | Color math — `lerp`, `multiStopColor`, per-variable stops, `getColor`, `bubbleColor` |
| 130–150 | Formatters — `fmtPrice`, `fmtTemp`, `fmtPct`, `fmtNum`, `stopsToGradient` |
| 152–170 | `riskBadge`, `riskBarColor` — Tailwind class lookups by risk tier |
| 172–181 | `DetailRow` — tiny label/value row component used in the detail panel |
| 183–289 | `CityDetailPanel` — right-sidebar component, fed by `selectedCity` |
| 291–664 | `Home` — default export; state, effects, map init, layer build, JSX |

---

## State (all in `Home`)

| Name | Kind | Purpose |
|---|---|---|
| `month` | `useState(6)` | Selected month (0 = Jan, 11 = Dec) |
| `variable` | `useState('temperature')` | Active heatmap variable |
| `bubbleMetric` | `useState('resilience_score')` | Active bubble color metric |
| `climateData` | `useState(null)` | Current month's `{ lats, lons, temperature, precipitation, sunshine }` |
| `cities` | `useState(null)` | ~230 cities from `cities_all.json`, loaded once |
| `loading` | `useState(false)` | Slider spinner while a new month is fetching |
| `hoverInfo` | `useState(null)` | Floating tooltip payload (`type: 'grid' | 'city'`) |
| `selectedCity` | `useState(null)` | City whose detail panel is open |
| `mapContainer` | `useRef` | DOM node MapLibre attaches to |
| `mapRef` | `useRef` | MapLibre `Map` instance |
| `overlayRef` | `useRef` | deck.gl `MapboxOverlay` instance |
| `cache` | `useRef({})` | Month key → climate JSON cache (instant on revisit) |
| `bubbleRange` | `useRef({min,max})` | Current bubble-metric min/max for color scaling |

---

## Key effects

- **Initial load** (`useEffect [] `, line 334) — fetch default month and `cities_all.json`. The JSON is read as text and `NaN` is replaced with `null` before `JSON.parse`, since raw JSON cannot represent `NaN`.
- **Map init** (`useEffect [] `, line 343) — create MapLibre map, attach `MapboxOverlay({ interleaved: true })`, lock `maxBounds` to Europe, tweak Positron boundary/label paint properties on `style.load`.
- **Bubble range** (`useEffect [cities, bubbleMetric] `, line 309) — recompute `bubbleRange.current` min/max for the selected metric.
- **Layer build** (`useEffect [climateData, variable, cities, bubbleMetric] `, line 400) — the workhorse. Builds the heatmap polygons + city bubbles and calls `overlayRef.current.setProps({ layers })`. Heatmap uses `beforeId: 'boundary_county'` so borders/labels stay visible; bubbles omit `beforeId` to render above water polygons.

---

## Diagrams

Open in [excalidraw.com](https://excalidraw.com) (File → Open) or the VS Code Excalidraw extension.

### 1. Component tree & state ownership
![Component tree](diagrams/component-tree.excalidraw)
[`diagrams/component-tree.excalidraw`](diagrams/component-tree.excalidraw)

`Home` is the only stateful piece. `CityDetailPanel` and `DetailRow` are presentational and receive everything via props.

### 2. Data flow — JSON → state → layers → map
![Data flow](diagrams/data-flow.excalidraw)
[`diagrams/data-flow.excalidraw`](diagrams/data-flow.excalidraw)

Two source streams (12 lazy climate JSONs + one cities JSON) fan into React state, then one `useEffect` rebuilds both deck.gl layers and hands them to `MapboxOverlay`, which composites them into MapLibre's `<canvas>`.

### 3. User interaction flows
![User flow](diagrams/user-flow.excalidraw)
[`diagrams/user-flow.excalidraw`](diagrams/user-flow.excalidraw)

Three lanes: month slider (loads data, may show spinner), variable button (recolors only — fast), city click (opens detail panel, no map re-render).

---

## Gotchas worth knowing

- **Fixed color ranges.** `VARIABLES[*].fixedMin/Max` stay constant across months on purpose — earlier code scaled per-month, which made January look as red as July. See comment at lines 22–30.
- **`updateTriggers` on the bubble layer.** Switching `bubbleMetric` doesn't change the `cities` array reference, so deck.gl would skip recoloring without `updateTriggers.getFillColor`. Lines 487–489.
- **Interleaved layer ordering.** Heatmap sits *under* boundaries (`beforeId: 'boundary_county'`); bubbles sit on top of everything (no `beforeId`) to avoid being clipped at coastlines. Lines 428–432 and 465–470.
- **Map cleanup.** The map-init effect returns `() => map.remove()` so React Strict Mode's double-mount doesn't leak a canvas.
- **`NaN` handling for cities.** `cities_all.json` is processed as text-with-substitution because the upstream Python may write `NaN`. Line 338.

---

## Assumptions / gaps / follow-ups

- These docs assume the data contract documented in the project `CLAUDE.md` (climate grid shape, cities schema). If those shapes drift, this doc will need an update.
- The diagrams are static — they will not auto-update if `page.js` is refactored. Re-run the doc generator after substantial changes.
- Not covered (out of scope for the lite version): per-prop API tables for `DetailRow`/`CityDetailPanel`, Tailwind class breakdown, deep dive into MapLibre layer IDs.
