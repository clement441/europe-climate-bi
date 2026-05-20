# European Climate & Living Costs BI Dashboard

## Project Overview
Interactive web dashboard mapping European climate data and cost-of-living metrics. Built with Next.js, MapLibre GL, and Deck.gl. Deployed to Vercel.

This is a freelance portfolio project demonstrating end-to-end data skills: raw data acquisition → Python processing pipeline → Next.js web app.

## Repo Structure

```
europe-climate-bi/
  data/
    raw/          -- ~4 GB ERA5 NetCDF files + cost-of-living.csv -- gitignored
    processed/    -- committed outputs (climate_normals/, cities CSVs, cities_all.json)
  scripts/        -- Python pipeline (4 scripts: process_era5, geocode_cities,
                     fetch_projections, build_city_dataset)
  requirements.txt
  web/            -- Next.js app, deployed to Vercel (root dir = web/)
    src/app/      -- layout.js (shell) + page.js (entire app, single route)
    src/components/ -- FilterBoard, CityDetailPanel, ComparePanel, CitySearch, Flag
    src/lib/      -- colorScales, constants, countryFlags, gridUtils, utils
    public/data/  -- cities_all.json, borders.geojson, climate_normals/ (12 JSON files)
  docs/           -- app-overview.md (full onboarding doc), improvements-roadmap.md,
                     diagrams/ (Excalidraw files)
  .venv/          -- gitignored
```

## Data Pipeline (scripts/)

Two independent pipelines both write to `web/public/data/`:

- **Pipeline A -- Climate grid:** `scripts/process_era5.py` reads ERA5 NetCDF
  files, slices to Europe, computes 1991-2020 WMO normals, exports 12 monthly
  JSON files (~1 MB each) and copies them automatically to
  `web/public/data/climate_normals/`.

- **Pipeline B -- City data (3 scripts, run in order):**
  1. `scripts/geocode_cities.py` -- Nominatim lat/lon lookup, writes `cities_master.csv`
  2. `scripts/fetch_projections.py` -- Open-Meteo 4-model ensemble, writes `climate_projections.csv`
  3. `scripts/build_city_dataset.py` -- merges all inputs, computes resilience score,
     writes `cities_all.json` to both `data/processed/` and `web/public/data/` automatically

Python environment: activate `.venv` before running scripts.

## Web App (web/)

### Architecture: Three-Layer Map

- **Layer 1 -- Climate heatmap (bottom, below basemap borders):** ~43,000
  `SolidPolygonLayer` cells at 0.25-deg resolution. Month slider lazy-loads one
  of 12 JSON files; variable selector (temp/precip/sun) switches color scale with
  fixed global ranges (no per-month rescaling).
- **Layer 2 -- Country borders (middle, above heatmap, below labels):**
  `GeoJsonLayer` from `borders.geojson` so borders remain legible over heatmap.
- **Layer 3 -- City bubbles (top):** 231-city `ScatterplotLayer`, colored by
  selected bubble metric (resilience, cost, rent, temp change, precip change).

### Tech Stack
- Next.js 16, React 19, App Router, static export
- MapLibre GL JS 5 -- CartoDB Positron basemap (free tiles)
- Deck.gl 9 -- data layers via `MapboxOverlay` (interleaved mode)
- Tailwind CSS 4
- Fuse.js 7 -- city fuzzy search

### Key UI Features (all shipped)
- Month slider with lazy loading + client-side cache
- Variable and bubble-metric selectors with color legends
- Hover tooltips on heatmap cells and city bubbles
- City detail panel: tabbed Climate / Cost / Resilience, sparkline, ring gauge
- City search (fuzzy, keyboard nav, flies map to selection)
- Compare two cities side-by-side (7 metrics, winner bars)
- Mobile bottom-sheet layout for filter board and city panel

### Deployment
- Vercel, root directory = `web/`, static export (`output: 'export'` in next.config.mjs)

### Heatmap Design Rules
- CELL_SIZE = 0.25 deg (full grid step, zero seams), alpha 140/255
- Ocean cells (null temperature) skipped -- never rendered
- Fixed global color ranges: temperature -15 to 35 degC, precipitation 0 to 200 mm,
  sunshine 0 to 14 h/day (consistent across all months)
- Color scales: temperature RdYlBu reversed (5-stop); precipitation yellow-to-dark-blue;
  sunshine purple-blue-cyan-yellow-orange-red

## Docs
- `docs/app-overview.md` -- full system overview (start here for onboarding)
- `docs/improvements-roadmap.md` -- shipped phases 1-4, locked design decisions
- `docs/diagrams/` -- Excalidraw app-overview and data-pipeline diagrams

Note: docs/data-pipeline.md and docs/page.md referenced in older commits no longer
exist. The app-overview.md now covers state tables and pipeline steps.
