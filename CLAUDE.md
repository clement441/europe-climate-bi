# European Climate & Living Costs BI Dashboard

## Project Overview
Interactive web dashboard mapping European climate data and cost-of-living metrics. Built with Next.js, MapLibre GL, and Deck.gl. Deployed to Vercel.

This is a freelance portfolio project demonstrating end-to-end data skills: raw data acquisition → Python processing pipeline → Next.js web app.

## Repo Structure
```
europe-climate-bi/
├── data/
│   ├── raw/          # ~4GB raw ERA5 NetCDF files — gitignored, never commit
│   ├── cache/        # intermediate processing cache — gitignored
│   └── processed/    # ~15MB final outputs used by scripts — committed
├── scripts/          # Python data pipeline (run in order: 01_ → 06_)
├── notebooks/        # Exploratory analysis and QA
├── requirements.txt  # Python dependencies
├── web/              # Next.js app — deployed to Vercel
└── .venv/            # Python virtual environment — gitignored
```

## Data Pipeline (scripts/)
- `update_cities.py` — End-to-end pipeline for the city dataset: geocodes new cities
  via Nominatim, fetches climate projections from Open-Meteo, computes resilience
  scores, and exports `cities_all.json` into both `data/processed/` and
  `web/public/data/`. Re-runs are incremental — only new cities are geocoded and
  projected.

The ERA5 climate-grid normals (`web/public/data/climate_normals/climate_*.json`)
are processed separately and committed under `data/processed/`. The processing
notebook lives in `notebooks/`.

Python environment: activate `.venv` before running scripts.

## Web App (web/)

### Architecture: Dual-Layer Map
- **Layer 1 — Climate heatmap (bottom):** ERA5 gridded data at 0.25° resolution (~43,000 cells covering Europe). Rendered as semi-transparent colored rectangles. User selects month (Jan–Dec) and variable (temperature, precipitation, sunshine).
- **Layer 2 — City bubbles (top):** ~230 European cities with cost-of-living data, climate change projections, and resilience scores.

### Data Files (in web/public/data/)
#### Climate Grid: public/data/climate_normals/
- 12 JSON files: `climate_jan.json` through `climate_dec.json`
- Each contains: `{ month, lats, lons, temperature, precipitation, sunshine }`
- `lats`: array of 153 latitude values (72°N to 34°N)
- `lons`: array of 281 longitude values (-25°W to 45°E)
- `temperature`: 2D array [153][281] in °C (1991-2020 monthly normal)
- `precipitation`: 2D array [153][281] in mm/month
- `sunshine`: 2D array [153][281] in hours/day
- Total: ~1 MB per file, lazy loaded by month

#### City Data: public/data/cities_all.json
- ~230 cities with identity, cost-of-living, climate projections, and resilience data
- Small enough to load entirely on page load

### Tech Stack
- Next.js 15 with App Router, static export
- MapLibre GL JS — base map (CartoDB Positron tiles, free)
- Deck.gl — data layers (SolidPolygonLayer for heatmap, ScatterplotLayer for cities)
- Tailwind CSS

### Deployment
- Vercel, configured with root directory = `web/`
- Static export (`next export`)

### Heatmap Design Rules
- Opacity: 0.5–0.6 (base map borders/labels must remain visible)
- Grid cells slightly smaller than grid spacing — never edge-to-edge solid fill
- Ocean cells hidden (null/NaN temperature → skip)
- Color scales:
  - Temperature: blue (cold) → white (mild) → red (hot)
  - Precipitation: light yellow (dry) → dark blue (wet)
  - Sunshine: dark purple → blue → cyan → yellow → orange → gold

### Current Status
- ✅ Full-screen MapLibre map with CartoDB Positron basemap
- ✅ Climate heatmap layer (SolidPolygonLayer, ~43k cells)
- ✅ Month slider (Jan–Dec) with lazy loading and caching
- ✅ Variable selector (temperature/precipitation/sunshine) with per-variable color scales
- ✅ Dynamic per-month color scaling for maximum visual contrast
- ✅ Heatmap hover tooltips (all 3 variables + coordinates)
- ✅ City bubble layer (231 cities, ScatterplotLayer)
- ✅ Bubble metric selector (resilience, cost of living, rent, temp change, precip change)
- ✅ City detail panel (click → right sidebar with full city data)
- ✅ Color legends, title/branding, loading states, number formatting
- ⬜ Deploy to Vercel
