# Diagram Brief: Data Pipeline — European Climate & Living Costs

**Layout**: left-to-right
**Flow summary**: Shows two independent pipelines stacked vertically — Pipeline A transforms ERA5 NetCDF satellite files into monthly climate grids; Pipeline B geocodes cities, fetches climate projections, and merges everything into a single city JSON — both writing their final outputs into web/public/data/ for the Next.js app.

---

## Elements

Create a group labeled "Pipeline A — Climate Grid (process_era5.py)" that contains: ERA5 NetCDF Files, process_era5.py, Monthly Climate JSONs.

Create a group labeled "Pipeline B — City Dataset (3 scripts, run in order)" that contains: cost-of-living.csv, Nominatim API, geocode_cities.py, cities_master.csv, Open-Meteo Climate API, openmeteo.sqlite, fetch_projections.py, climate_projections.csv, build_city_dataset.py, cities_all.json.

Create a box labeled "ERA5 NetCDF Files". Note: two raw files from Copernicus CDS — temperature (~1.3 GB) and precipitation/radiation (~2.6 GB). Gitignored; must be downloaded manually.

Create a box labeled "process_era5.py". Note: single script, two internal stages — (1) load, reproject longitude, slice to Europe bbox, convert units, compute Ångström-Prescott sunshine hours; (2) compute 1991-2020 WMO 30-year normals and export 12 monthly JSON files + metadata. Requires ~8 GB RAM.

Create a box labeled "Monthly Climate JSONs". Note: 13 files written to both data/processed/climate_normals/ and web/public/data/climate_normals/ — climate_{jan|...|dec}.json (153×281 grid, ~1 MB each) + metadata.json.

Create a box labeled "cost-of-living.csv". Note: 231 European cities with Numbeo cost metrics. Gitignored raw file; no fetch script — must be updated manually.

Create a box labeled "Nominatim API". Note: OpenStreetMap geocoding API. No key required. Rate-limited to 1 request/second.

Create a box labeled "geocode_cities.py". Note: Stage 1. Incremental — only geocodes cities absent from existing cities_master.csv. Pristina/Kosovo returns null coordinates and is excluded downstream.

Create a box labeled "cities_master.csv". Note: intermediate file. 231 rows with city, country, lat, lon columns. Consumed by both fetch_projections.py and build_city_dataset.py.

Create a box labeled "Open-Meteo Climate API". Note: free CMIP6 climate projection API. Returns daily data 1991-2050 across 4 GCMs per city. No key required.

Create a box labeled "openmeteo.sqlite". Note: SQLite HTTP response cache (requests_cache). Expires after 24 hours; gitignored. Avoids re-fetching on same-day re-runs.

Create a box labeled "fetch_projections.py". Note: Stage 2. Fetches a 4-model GCM ensemble per city, averages into ensemble mean, computes deltas (temp, summer temp, precipitation %, heat days) for baseline 1991-2020 vs future 2040-2050. Takes 10-30 min on first run.

Create a box labeled "climate_projections.csv". Note: intermediate file. One row per city with 12 climate projection columns (baseline_temp_c, delta_temp_c, delta_precip_pct, etc.).

Create a box labeled "build_city_dataset.py". Note: Stage 3. Merges all three inputs; computes resilience_score (0-100) via min-max normalization of 4 vulnerability sub-scores; assigns risk_tier (Low/Moderate/High/Critical). No API calls; completes in seconds.

Create a box labeled "cities_all.json". Note: final output. 231-city JSON array written to both data/processed/cities_all.json and web/public/data/cities_all.json. Each city has identity, cost, climate projection, resilience_score, and risk_tier fields.

Draw an arrow from ERA5 NetCDF Files to process_era5.py. Label it "temperature, precipitation, solar radiation (xarray lazy load)".

Draw an arrow from process_era5.py to Monthly Climate JSONs. Label it "12 × climate_{month}.json + metadata.json".

Draw an arrow from cost-of-living.csv to geocode_cities.py. Label it "city, country columns".

Draw an arrow from Nominatim API to geocode_cities.py. Label it "lat/lon per city (1 req/sec)".

Draw an arrow from geocode_cities.py to cities_master.csv. Label it "city, country, lat, lon".

Draw an arrow from cities_master.csv to fetch_projections.py. Label it "city coordinates (null-coord cities skipped)".

Draw an arrow from Open-Meteo Climate API to fetch_projections.py. Label it "daily climate data 1991-2050 (4 GCMs per city)".

Draw an arrow from fetch_projections.py to openmeteo.sqlite. Label it "cache responses (24 h TTL)".

Draw an arrow from openmeteo.sqlite to fetch_projections.py. Label it "replay cached responses".

Draw an arrow from fetch_projections.py to climate_projections.csv. Label it "climate deltas per city".

Draw an arrow from cost-of-living.csv to build_city_dataset.py. Label it "cost-of-living metrics (13 Numbeo fields)".

Draw an arrow from cities_master.csv to build_city_dataset.py. Label it "geocoordinates".

Draw an arrow from climate_projections.csv to build_city_dataset.py. Label it "climate projection fields".

Draw an arrow from build_city_dataset.py to cities_all.json. Label it "merged city JSON (both data/processed/ and web/public/data/)".

Mark ERA5 NetCDF Files as external.

Mark Nominatim API as external.

Mark Open-Meteo Climate API as external.

Mark cost-of-living.csv as external.

Mark process_era5.py as entry point.

Mark geocode_cities.py as entry point.

Add a note to Monthly Climate JSONs: "Committed to repo — frontend works on a clean clone without re-running Pipeline A."

Add a note to cities_all.json: "Committed to repo — frontend works on a clean clone without re-running Pipeline B."

Add a note to openmeteo.sqlite: "Gitignored. On a clean clone the full 10-30 min fetch must run before build_city_dataset.py can produce complete data."

---

## Notes

- **No orchestration.** There is no Makefile or DAG. The four scripts must be run individually in order: process_era5.py (standalone), then geocode_cities.py → fetch_projections.py → build_city_dataset.py.
- **Incremental by design.** geocode_cities.py and fetch_projections.py both skip cities already present in their output CSV, making re-runs fast when only new cities are added.
- **Pipeline A auto-copy may silently skip.** If web/public/data/ is absent when process_era5.py runs, the web copy is skipped with a warning. A manual copy from data/processed/climate_normals/ to web/public/data/climate_normals/ is then required.
- **Resilience scores are dataset-relative.** Adding or removing cities shifts all scores. Treat as relative rankings, not absolute measures.
- **Pristina/Kosovo excluded.** Nominatim cannot resolve this city; it gets null coordinates and is silently excluded from all downstream stages.
