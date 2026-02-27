# European Climate & Living Costs BI Dashboard

## Project Overview
Interactive web dashboard mapping European climate data and cost-of-living metrics. Built with Next.js, MapLibre GL, and Deck.gl. Will be deployed to Vercel.

## Architecture: Dual-Layer Map
The map has two independent layers rendered on the same canvas:
- **Layer 1 — Climate heatmap (bottom):** ERA5 gridded data at 0.25° resolution (~43,000 cells covering Europe). Rendered as semi-transparent colored rectangles. User selects month (Jan–Dec) and variable (temperature, precipitation, sunshine hours).
- **Layer 2 — City bubbles (top):** ~230 European cities with cost-of-living data, climate change projections, and resilience scores. Rendered as colored/sized circle markers. User can toggle what the bubbles represent.

## Data Files (in public/data/)
### Climate Grid: public/data/climate_normals/
- 12 JSON files: `climate_jan.json` through `climate_dec.json`
- Each contains: `{ month, lats, lons, temperature, precipitation, sunshine }`
- `lats`: array of 153 latitude values (72°N to 34°N)
- `lons`: array of 281 longitude values (-25°W to 45°E)
- `temperature`: 2D array [153][281] in °C (1991-2020 monthly normal)
- `precipitation`: 2D array [153][281] in mm/month
- `sunshine`: 2D array [153][281] in hours/day
- `metadata.json`: coordinate arrays, variable names, units
- Total: ~1 MB per file, load one at a time (lazy loading by month)

### City Data: public/data/cities_all.json
- Array of ~230 city objects, each containing:
- Identity: `city`, `country`, `lat`, `lon`
- Cost of living: `cost-of-living-index`, `one-bedroom-city-rent`, `three-bedroom-city-rent`, `meal-restaurant`, `monthly-public-transport-pass`, `1l-milk`, `chicken`, `bread`, `rice`, `cinema-ticket`, `basic-utilities-85m2-apartment`, `price-square-meter-buy`
- Climate projections: `baseline_temp_c`, `future_temp_c`, `delta_temp_c`, `delta_summer_temp_c`, `delta_precip_pct`, `baseline_heat_days`, `future_heat_days`, `delta_heat_days`
- Resilience: `resilience_score` (0-100, higher = more resilient), `risk_tier` ("Low Risk", "Moderate Risk", "High Risk", "Critical")
- ~230 cities, small enough to load entirely on page load

## UI Layout Plan
- Full-screen map
- Top-left: controls panel with month slider, variable selector (temperature/precipitation/sunshine), bubble metric selector
- Hover on heatmap grid cell → tooltip showing that cell's values
- Hover/click on city bubble → detail panel with all city data
- Heatmap opacity: ~60-70% so base map shows through
- Color scales: temperature (blue→red), precipitation (yellow→blue), sunshine (gray→orange)

## Tech Stack
- Next.js 15 with App Router
- MapLibre GL JS for base map (free CartoDB Positron tiles)
- Deck.gl for data layers (GridCellLayer or ScatterplotLayer for heatmap, ScatterplotLayer for cities)
- Tailwind CSS for UI styling
- Static export to Vercel

## Current Status
- ✅ Full-screen MapLibre map with CartoDB Positron basemap
- ✅ Climate heatmap layer rendering with Deck.gl SolidPolygonLayer (~43k cells)
- ✅ Month slider (Jan–Dec) with lazy loading and caching of JSON files
- ✅ Variable selector (temperature/precipitation/sunshine) with per-variable color scales
- ✅ Controls panel (top-left, Tailwind-styled) with data range display and loading indicator
- ✅ Dynamic per-month color scaling (min/max from actual data) for maximum visual contrast
- ✅ Multi-stop sunshine gradient (purple→blue→cyan→yellow→orange→gold) for better differentiation
- ✅ Heatmap hover tooltips showing all 3 variables + coordinates
- ✅ City bubble layer (231 cities, ScatterplotLayer, hover tooltips)
- ✅ Bubble metric selector (resilience, cost of living, rent, temp change, precip change) with dynamic coloring
- ✅ City detail panel (click to open right sidebar with full city data: costs, groceries, climate projections, resilience)
- ✅ Polish: color legends (heatmap gradient + bubble gradient), title/branding, loading states with disabled slider, empty state hint, responsive detail panel, improved number formatting, grouped controls layout

## Design Guidelines for Heatmap Layer
- Heatmap opacity should be 0.5-0.6 (semi-transparent so base map borders/labels show through)
- Grid cells should NOT fill the entire space — leave slight gaps between cells or use slightly smaller rectangles so the map doesn't look like a solid block of color
- Country borders and coastlines from the base map MUST be visible through/between the heatmap cells
- Consider rendering grid cells as small squares (slightly smaller than the actual grid spacing) rather than edge-to-edge rectangles
- The base map style (CartoDB Positron) already has country borders and labels — these should remain readable on top of or through the heatmap
- Color scale for temperature: blue (cold) → white (mild) → red (hot)
- Color scale for precipitation: light yellow (dry) → dark blue (wet)
- Color scale for sunshine: dark purple (#4a1486) → blue (#2b8cbe) → cyan (#a6d9ed) → yellow (#fee391) → orange (#f46d43) → gold (#ffcc00)
- Ocean grid cells should be hidden (check if temperature is null/NaN and skip those cells)

## Implementation Order
1. ✅ Basic map showing
2. ✅ Climate heatmap layer (load one month, render colored grid)
3. ✅ Month slider and variable selector
4. ✅ Heatmap hover tooltips
5. ✅ City bubble layer from cities_all.json
6. ✅ City click detail panel + bubble metric selector
8. ✅ Polish: legends, styling, loading states
9. Deploy to Vercel