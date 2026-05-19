# Improvements Roadmap

Pre-deploy polish + portfolio-juice features for the European Climate &
Living Costs dashboard. All planned work is now shipped.

---

## Phase 1 — Visual fixes ✅

Three pain points addressed (commit `bcf2a52`):

1. **Country borders not visible behind heatmap** — fixed by dropping
   heatmap alpha (179 → 150) and overlaying Natural Earth admin-0
   boundary lines as a deck.gl GeoJsonLayer rendered above the heatmap
   but below labels (`beforeId: "place_continent"`). Boundary data lives
   at `web/public/data/borders.geojson` (192 KB, pre-clipped to Europe
   bbox from the 50m Natural Earth source).
2. **Temperature scale washing out in March/April** — replaced the
   blue → white → red 3-stop scale with a 5-stop ColorBrewer RdYlBu
   reversed. Pale yellow at the midpoint means 5–15 °C reads clearly
   instead of disappearing into the basemap.
3. **Filter board + city detail panel redesign** — both rebuilt with
   an "editorial climate observatory" aesthetic: Instrument Serif
   italic for display, Geist Mono for labels/data, slate-900 + amber-500
   accents on frosted glass. City panel now uses tabbed
   Climate / Cost / Resilience layout with sticky header, SVG ring
   gauge for resilience score, and a 12-month sparkline placeholder.

### Follow-ups

- [x] **Sparkline data is fake** — wired real per-city monthly temperatures
  by fetching all 12 `climate_normals/climate_*.json` files in parallel,
  finding the nearest ERA5 grid cell for the city's lat/lon, and passing
  the 12-value array to `Sparkline`. Module-level cache avoids re-fetching
  across city selections. Dashed placeholder shown while loading.
- [x] **Country flag emoji on Windows** — replaced emoji map with ISO
  3166-1 alpha-2 codes; flags now render as `<img>` from `flagcdn.com`
  with an `onError` fallback. Cross-OS consistent.
- [x] **Pre-existing lint warning** at `web/src/app/page.js:111` —
  replaced `useState` + `useEffect` pair for `bubbleRange` with a single
  `useMemo`. Eliminates the extra render.

---

## Phase 2 — Discoverability ✅

### 2.1 City search ✅

- `fuse.js`-powered fuzzy match on `city` + `country` (weighted 0.7 / 0.3),
  threshold 0.35, up to 8 results. Scales to world-cities datasets without
  re-architecting.
- `CitySearch` component placed at the top of the filter board (under the
  header) for maximum discoverability. Full keyboard nav: ↑/↓ to move,
  Enter to select, Esc to close, clear button on the input.
- Selecting a city opens the detail panel AND calls
  `map.flyTo({ center, zoom: 6, duration: 1200 })`.
- Dropdown matches editorial aesthetic: hairline amber accent at top,
  serif italic city name + mono uppercase country, amber edge bar on
  active row.
- ISO flag map extracted to `web/src/lib/countryFlags.js` (shared with
  `CityDetailPanel`).

### 2.2 ~~Shareable URL state~~ — dropped

Not needed. The dashboard is a single-link experience; encoding view
state in the query string adds complexity with little payoff.

---

## Phase 3 — Headline interactions ✅

### 3.1 Compare cities ✅

Full head-to-head city comparison, accessible from two entry points:

**Entry points:**
- **Filter board tray** (always visible at the bottom of the filter board):
  two slots; empty slots show a dashed "+ Add a city" button that inline-
  expands into a `CitySearch` input (auto-focused, excludes already-pinned
  cities). Only the next empty slot is shown — no double-empty-slot clutter.
  A "View comparison →" button appears when both slots are filled.
- **City detail panel** — "+ Compare" / "Pinned ✓" toggle button in the
  header; opens compare view directly from the panel.

**Compare view (inside the city detail panel):**
- Replaces the tab content when 2 cities are pinned.
- 7 metrics in two groups:

  *Cost & Resilience* (4 rows):
  Cost-of-Living index, 1-Bed Rent, Projected Warming (Δ°C by 2050),
  Resilience Score. Winner bar in emerald-500, loser in slate-300.
  Ties and missing values show slate. No amber-dot duplication.

  *Current Month Climate* (3 rows, labeled e.g. "July Climate"):
  Temperature, Precipitation, Sunshine — each bar colored using the
  **same heatmap palette** as the map (absolute scale: −15→35°C,
  0→200mm, 0→14h/day). No winner concept; both bars use the color
  that matches their map cell color.

- Sticky footer: two city chips (flag + name) for quick navigation or
  unpinning.
- Full scroll on overflow (flex-1/min-h-0 layout).

**Other UX decisions:**
- Max compare count: **2 cities**.
- Risk-tier badge in the panel header prefixed with "Climate Risk" label
  so the tier is unambiguous.
- `CitySearch` gained `hideLabel`, `placeholder`, `excludeCities`, and
  `autoFocus` props so it can be reused in the compare tray without a fork.
- Shared `web/src/lib/gridUtils.js` exposes `nearestIdx` and
  `nearestGridValue` (used by both `CityDetailPanel` sparkline fetch and
  `ComparePanel` climate lookups).

---

## Phase 4 — Polish ✅

- [x] **Heatmap grid seams** — increased `CELL_SIZE` to the full 0.25° grid
  step (zero gaps) and reduced alpha 150 → 140 to compensate. Natural Earth
  border overlay keeps country lines legible.
- [x] **Mobile bottom-sheet layout** — filter board and city detail panel
  convert to CSS `translateY` bottom sheets on narrow viewports (< 640px).
  Tap handle to expand filter; city panel slides up with a spring animation
  and can be dismissed by tapping the backdrop. Desktop layout unchanged.

---

## Decisions already made

- **Color scale direction:** RdYlBu reversed (locked in Phase 1).
- **Border fix approach:** Both layers of defense — fix layer IDs +
  Natural Earth overlay (locked in Phase 1).
- **Detail panel structure:** Tabbed Climate / Cost / Resilience
  (locked in Phase 1).
- **Display typography:** Instrument Serif italic for headings,
  Geist Mono for labels, Geist Sans for body.
- **Accent color:** amber-500 (#f59e0b) — feels climate-appropriate.
- **Compare max cities:** 2 (locked in Phase 3.1).
- **Compare bar colors:** emerald-500 winner / slate-300 loser for
  cost/resilience; heatmap palette (absolute scale) for climate metrics.

---

## File map

- `web/src/app/page.js` — main page, filter board, compare tray, hover tooltip
- `web/src/app/layout.js` — fonts + metadata
- `web/src/app/globals.css` — Tailwind theme tokens + tab fade keyframe
- `web/src/components/CityDetailPanel.js` — tabbed panel, compare toggle, risk badge
- `web/src/components/ComparePanel.js` — 7-metric compare view, bar coloring
- `web/src/components/CitySearch.js` — fuzzy search (reused in compare tray)
- `web/src/lib/colorScales.js` — color ramps for heatmap + bubbles + compare bars
- `web/src/lib/countryFlags.js` — ISO 3166-1 alpha-2 lookup
- `web/src/lib/gridUtils.js` — `nearestIdx`, `nearestGridValue` (shared utility)
- `web/public/data/cities_all.json` — ~230 cities, full feature data
- `web/public/data/climate_normals/climate_*.json` — 12 monthly files
- `web/public/data/borders.geojson` — Natural Earth admin-0 lines
