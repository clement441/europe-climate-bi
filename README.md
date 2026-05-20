# European Climate & Living Costs

An interactive map dashboard that overlays 30 years of European climate science with city-level cost-of-living data — so you can explore, compare, and make sense of Europe across both dimensions.

**Live demo:** [europe-climate-bi.vercel.app](https://europe-climate-bi.vercel.app)

---

## What it shows

- **Climate heatmap** — 1991–2020 monthly climate normals (temperature, rainfall, sunshine) at 0.25° grid resolution (~28 km per cell) across Europe. Drag the month slider to travel through the year; the colour scale is fixed so January blues and July reds are directly comparable.
- **231 cities** — each bubble is colour-coded by the metric you choose: resilience score, cost-of-living index, rent, or projected climate change.
- **City detail panel** — click any city for its full climate profile, cost breakdown (rent, groceries, utilities, transport), and a projected temperature/precipitation shift by 2050.
- **Side-by-side comparison** — pin two cities to compare 7 metrics with winner highlighting.
- **City search** — fuzzy matching (Fuse.js) handles typos and partial names.

---

## Data sources

| Layer | Source |
|---|---|
| Climate heatmap | [ERA5 / Copernicus](https://cds.climate.copernicus.eu/) — ECMWF global reanalysis, 1991–2020 WMO 30-year normals |
| City climate projections | [Open-Meteo](https://open-meteo.com/en/docs/climate-api) — 4-model CMIP6 ensemble, 2050 under SSP2-4.5 |
| Cost of living | [Numbeo](https://www.numbeo.com/) — crowdsourced metrics for 231 European cities |

---

## Tech stack

**Web app**
- [Next.js 16](https://nextjs.org/) (React 19, App Router, static export → Vercel)
- [MapLibre GL JS 5](https://maplibre.org/) — CartoDB Positron basemap
- [Deck.gl 9](https://deck.gl/) — WebGL data layers (interleaved mode)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Fuse.js 7](https://www.fusejs.io/) — fuzzy city search

**Data pipeline (Python)**
- `xarray`, `numpy`, `pandas` — ERA5 NetCDF processing
- `geopy` (Nominatim) — city geocoding
- `openmeteo-requests`, `requests-cache` — climate projection API

---

## Project structure

```
europe-climate-bi/
  data/
    raw/              # ERA5 NetCDF files + cost-of-living.csv (gitignored, ~4 GB)
    processed/        # committed pipeline outputs
  scripts/            # Python data pipeline (run in order — see below)
  web/                # Next.js app (Vercel root directory)
    src/app/          # page.js (map app) + about/page.js
    src/components/   # FilterBoard, CityDetailPanel, ComparePanel, CitySearch, Flag
    src/lib/          # colorScales, constants, gridUtils, utils
    public/data/      # cities_all.json, borders.geojson, climate_normals/ (12 JSON files)
  requirements.txt
```

---

## Running locally

### Web app

```bash
cd web
npm install
npm run dev
```

The app runs on committed data files in `web/public/data/` — no Python setup required for the frontend.

### Data pipeline

Requires the raw ERA5 files (~4 GB, download from [Copernicus CDS](https://cds.climate.copernicus.eu/)) and `data/raw/cost-of-living.csv` (Numbeo export).

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Pipeline A — climate grid (one-off, ~8 GB RAM needed)
python scripts/process_era5.py

# Pipeline B — city dataset (run in order)
python scripts/geocode_cities.py       # Nominatim geocoding (~10 min first run)
python scripts/fetch_projections.py    # Open-Meteo API (~10–30 min first run)
python scripts/build_city_dataset.py   # merge + resilience score (seconds)
```

Both pipelines write their final outputs directly into `web/public/data/`.

---

## About

Built by [Clément](https://www.datasaku.com/) — data scientist and AI developer. Through [Datasaku](https://www.datasaku.com/) I help agrifood businesses build data pipelines and AI systems, and take on data science, analysis, and AI development projects more broadly.

This dashboard is a portfolio piece demonstrating end-to-end data skills: raw satellite data acquisition, Python processing pipelines, and a polished interactive web application.
