# Diagram Brief: European Climate & Living Costs Dashboard

**Layout**: top-to-bottom
**Flow summary**: Shows how static JSON data and CDN tiles flow through the Next.js entry point into React state, which drives three Deck.gl layers rendered inside a MapLibre GL canvas.

---

## Elements

Create a group labeled "External Inputs" that contains: CartoDB Positron CDN, Static JSON Files, flagcdn.com CDN.

Create a box labeled "CartoDB Positron CDN". Note: serves basemap tiles (streets, borders, labels) over HTTPS at runtime.

Create a box labeled "Static JSON Files". Note: cities_all.json (231 cities), borders.geojson, and 12 climate_normals/climate_{month}.json files — all hosted under web/public/data/.

Create a box labeled "flagcdn.com CDN". Note: external CDN; serves country flag images as WebP by ISO code.

Create a group labeled "Next.js App — Vercel (static export)" that contains: layout.js, page.js, about/page.js.

Create a box labeled "layout.js". Note: HTML shell — sets page title, Open Graph meta tags, loads three Google Fonts (Geist Sans, Geist Mono, Instrument Serif). File: web/src/app/layout.js.

Create a box labeled "page.js". Note: route "/", owns the entire app — map init, all React state (14 useState/useMemo/useRef entries), all Deck.gl layer assembly, and event handlers. Cleanup resets mapRef, overlayRef, and layersRef to null. File: web/src/app/page.js.

Create a box labeled "about/page.js". Note: route "/about", static server component — plain-English intro, navigation guide, data-source attribution, author bio. No React state; linked from a floating button on the map and two links in FilterBoard. File: web/src/app/about/page.js.

Create a group labeled "UI Components (React)" that contains: FilterBoard, CityDetailPanel, ComparePanel, CitySearch.

Create a box labeled "FilterBoard". Note: left-side control panel — month slider, variable selector, bubble metric dropdown, city search embed, compare tray. File: web/src/components/FilterBoard.js.

Create a box labeled "CityDetailPanel". Note: right-side city panel — Climate / Cost / Resilience tabs, 12-month sparkline, resilience ring gauge, compare toggle. File: web/src/components/CityDetailPanel.js.

Create a box labeled "ComparePanel". Note: replaces tab body when 2 cities are pinned — 7 side-by-side bar metrics with winner highlighting. File: web/src/components/ComparePanel.js.

Create a box labeled "CitySearch". Note: Fuse.js fuzzy search input with keyboard nav and dropdown. Embedded inside FilterBoard and the compare tray. File: web/src/components/CitySearch.js.

Create a group labeled "Map Engine (MapLibre GL + Deck.gl)" that contains: MapLibre Map, Heatmap Layer, Borders Layer, City Bubbles Layer.

Create a box labeled "MapLibre Map". Note: WebGL tile map canvas — panning, zooming, CartoDB basemap. Deck.gl layers are inserted into its render pass via MapboxOverlay (interleaved mode).

Create a box labeled "Heatmap Layer". Note: SolidPolygonLayer — ~43 000 cells at 0.25° resolution, colored by temperature / precipitation / sunshine using fixed global ranges. Rebuilt when climateData or variable changes.

Create a box labeled "Borders Layer". Note: GeoJsonLayer — Natural Earth country boundary lines drawn above the heatmap but below city labels (beforeId: "place_continent"). Rebuilt once on mount.

Create a box labeled "City Bubbles Layer". Note: ScatterplotLayer — 231 city dots colored by selected bubble metric (resilience, cost, rent, Δtemp, Δprecip). Rebuilt when cities or bubbleMetric changes.

Draw an arrow from CartoDB Positron CDN to MapLibre Map. Label it "basemap tiles (HTTPS)".

Draw an arrow from Static JSON Files to page.js. Label it "fetch on mount (cities, borders) + lazy per month (climate)".

Draw an arrow from flagcdn.com CDN to CityDetailPanel. Label it "flag images (via Flag.js, onError silenced)".

Draw an arrow from layout.js to page.js. Label it "wraps in <body> with font CSS variables".

Draw an arrow from layout.js to about/page.js. Label it "wraps in <body> with font CSS variables".

Draw an arrow from page.js to about/page.js. Label it "floating About button + FilterBoard links (Next.js Link)".

Mark about/page.js as entry point.

Draw an arrow from page.js to FilterBoard. Label it "month, variable, bubbleMetric, cities, compareCities — props".

Draw an arrow from page.js to CityDetailPanel. Label it "selectedCity, compareCities, climateData, month — props".

Draw an arrow from FilterBoard to page.js. Label it "onMonthChange, onVariableChange, onCitySelect, onToggleCompare — callbacks".

Draw an arrow from CityDetailPanel to page.js. Label it "onToggleCompare, onCitySelect — callbacks".

Draw an arrow from FilterBoard to CitySearch. Label it "embeds CitySearch (also embedded in compare tray slots)".

Draw an arrow from CityDetailPanel to ComparePanel. Label it "renders ComparePanel when compareCities.length === 2".

Draw an arrow from page.js to Heatmap Layer. Label it "climateData + variable + colorScales.js".

Draw an arrow from page.js to Borders Layer. Label it "borders GeoJSON".

Draw an arrow from page.js to City Bubbles Layer. Label it "cities[] + bubbleMetric + colorScales.js".

Draw an arrow from Heatmap Layer to MapLibre Map. Label it "interleaved via MapboxOverlay (below border labels)".

Draw an arrow from Borders Layer to MapLibre Map. Label it "interleaved via MapboxOverlay (above heatmap)".

Draw an arrow from City Bubbles Layer to MapLibre Map. Label it "interleaved via MapboxOverlay (top layer)".

Mark page.js as entry point.

Mark CartoDB Positron CDN as external.

Mark Static JSON Files as external.

Mark flagcdn.com CDN as external.

Add a note to page.js: "Three independent useEffects rebuild only the changed layer slot; flushLayers() pushes all three to Deck.gl together to keep z-order stable."

Add a note to Heatmap Layer: "Ocean cells (null temperature) are skipped at build time — never passed to SolidPolygonLayer."

Add a note to Static JSON Files: "NaN tokens in cities_all.json are replaced with null before JSON.parse (Python json.dump emits NaN, which is invalid JSON)."

---

## Notes

- **Lib helpers** (colorScales.js, gridUtils.js, constants.js, countryFlags.js, utils.js) are pure utility modules imported by components and page.js. They have no side effects and are not drawn as separate boxes — they are implied by the arrows they annotate (e.g. "colorScales.js" on the arrow from page.js to each layer).
- **Month lazy loading**: the arrow from Static JSON Files to page.js covers both the on-mount fetch (cities, borders) and the lazy per-month fetch (climate normals). A useRef cache in page.js prevents re-fetching already-loaded months.
- **Sparkline fetch**: CityDetailPanel independently fetches all 12 climate files in parallel (Promise.all) when a city is selected, using a separate module-level cache. This is a second consumer of Static JSON Files not shown as a separate arrow to keep the diagram clean — add it if detail is needed.
- **Mobile layout**: FilterBoard and CityDetailPanel both switch to CSS translateY bottom-sheet layout below 640 px. This is a styling concern, not a data flow — not drawn.
