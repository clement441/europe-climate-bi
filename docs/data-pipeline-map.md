# Data Pipeline Map: European Climate & Living Costs BI Dashboard

> Generated: 2026-05-20 | Pipelines: 2 | Total stages: 7

---

## Pipeline Overview

Raw data enters from two sources: approximately 4 GB of ERA5 NetCDF reanalysis
files downloaded from the Copernicus Climate Data Store, and a Numbeo
cost-of-living CSV covering 231 European cities. Pipeline A (one script) ingests
the NetCDF files, reprojects the global longitude grid, computes 1991-2020 WMO
climate normals for temperature, precipitation, and sunshine hours across a
153×281 European grid, and writes 12 monthly JSON files plus a metadata file.
Pipeline B (three scripts run sequentially) geocodes each city via the Nominatim
API, fetches 1991-2050 daily climate projections from the Open-Meteo Climate API
across a four-model GCM ensemble, merges everything with the cost-of-living data,
computes a relative climate-resilience score per city, and writes a single
consolidated city JSON. Both pipelines write their final outputs directly into
`web/public/data/`, making them immediately available to the Next.js static
export without any additional copy step (though Pipeline A falls back to a manual
copy if the web directory is absent).

---

## Pipelines Summary

| Pipeline | Entry point | Final output | Trigger | Shared state with |
|----------|-------------|--------------|---------|-------------------|
| Pipeline A -- Climate Grid | `scripts/process_era5.py` | `web/public/data/climate_normals/` (12 JSON files + metadata) | manual | none |
| Pipeline B -- City Dataset | `scripts/geocode_cities.py` → `scripts/fetch_projections.py` → `scripts/build_city_dataset.py` | `web/public/data/cities_all.json` | manual | none |

---

## Pipeline A -- Climate Grid

> Processes two global ERA5 NetCDF files into 12 monthly JSON files of
> 1991-2020 climate normals (temperature, precipitation, sunshine) for a
> 153×281 European grid at 0.25° resolution, consumed by the heatmap layer.

### Stage 1: Load, Reproject, and Slice

**Script/File:** `scripts/process_era5.py`
**How to run:** `python scripts/process_era5.py` from the repo root with `.venv` activated. Requires ~8 GB RAM; takes several minutes.
**Reads:**
- `data/raw/data_stream-moda_stepType-avgua.nc` -- ERA5 monthly averages; variable `t2m` (2 m air temperature, Kelvin). Global 0.25° grid, Jan 1940 – Dec 2025, ~1.3 GB. Download from Copernicus CDS if absent.
- `data/raw/data_stream-moda_stepType-avgad.nc` -- ERA5 monthly accumulated fields; variables `tp` (total precipitation, m/day) and `ssrd` (surface solar radiation downwards, J/m²). Global 0.25° grid, Jan 1940 – Dec 2025, ~2.6 GB. Download from Copernicus CDS if absent.
**Writes:** (intermediate, in memory only; files written in Stage 2)
**Steps:**
1. Open both NetCDF files with xarray (lazy loading).
2. Remap the ERA5 0–360° longitude coordinate to -180–180° and re-sort both datasets.
3. Slice both datasets to the European bounding box: 72°N–34°N latitude, 25°W–45°E longitude, yielding a 153×281 cell grid.
4. Convert temperature from Kelvin to Celsius. Convert precipitation from m/day to mm/month by multiplying by 1000 and by the number of days in each month.
5. Compute sunshine hours per day using a vectorized Ångström-Prescott method: build per-month, per-latitude lookup tables for astronomical daylight hours and clear-sky radiation (using midpoint day-of-year, solar constant 1361 W/m², and declination), load the full SSRD array (~1 GB) into RAM, derive a sunshine fraction as actual SSRD divided by 75% of clear-sky maximum, and multiply by daylight hours. Clip to the physical range 0–16 h/day.
6. Filter all three variables to the WMO 1991-2020 reference period and compute the 30-year calendar-month mean, producing three arrays of shape (12, 153, 281).
**External APIs:** none
**Notes:** The ERA5 source files are gitignored and must be downloaded manually from the Copernicus Climate Data Store before running. The script halts with a clear error if either file is absent.

---

### Stage 2: Export Monthly JSON Files

**Script/File:** `scripts/process_era5.py` (continuation of Stage 1)
**How to run:** (same invocation as Stage 1 -- single script run covers both stages)
**Reads:** (normals arrays computed in Stage 1, held in memory)
**Writes:**
- `data/processed/climate_normals/climate_{jan|feb|...|dec}.json` -- 12 files, ~1 MB each. Each file contains the `month` index, flat `lats` and `lons` coordinate arrays, and 2-D arrays for `temperature` (°C), `precipitation` (mm/month), and `sunshine` (h/day). Ocean cells are stored as `null`.
- `data/processed/climate_normals/metadata.json` -- coordinate arrays, grid dimensions (153×281), variable names, units, baseline period, and grid bounding box.
- `web/public/data/climate_normals/` -- mirror copy of all 13 files above, written automatically via `shutil.copy2`. If `web/public/data/` does not exist the copy is skipped with a warning (see Gaps section).
**Steps:**
1. Round all grid values to one decimal place; replace NaN (ocean cells) with `None`.
2. Serialize each month as a compact JSON object (no whitespace) and write to `data/processed/climate_normals/`.
3. Write `metadata.json` with coordinate arrays and unit definitions.
4. Copy the entire `climate_normals/` directory to `web/public/data/climate_normals/` using `shutil.copy2`.
**External APIs:** none
**Notes:** The 12 JSON files are committed to the repo under `data/processed/climate_normals/` and `web/public/data/climate_normals/` so the frontend works without re-running the pipeline.

---

## Pipeline B -- City Dataset

> Produces `cities_all.json`, a 231-city record combining geocoordinates,
> Numbeo cost-of-living metrics, Open-Meteo 4-model climate projections, and
> a derived resilience score. The three scripts must be run in order.

### Stage 1: Geocode Cities

**Script/File:** `scripts/geocode_cities.py`
**How to run:** `python scripts/geocode_cities.py` from the repo root with `.venv` activated. First run takes ~4 minutes (231 cities × 1-second Nominatim rate limit). Incremental re-runs with no new cities finish in under a second.
**Reads:**
- `data/raw/cost-of-living.csv` -- 231 European cities with Numbeo cost-of-living metrics. Required columns for this step: `city`, `country`. (~4 KB, gitignored)
- `data/processed/cities_master.csv` -- (optional) previously geocoded cities; if present, only cities absent from it are re-geocoded.
**Writes:**
- `data/processed/cities_master.csv` -- all cities with `city`, `country`, `lat`, `lon` columns. Cities unresolvable by Nominatim (currently Pristina, Kosovo) receive `null` coordinates.
**Steps:**
1. Load and strip whitespace from `city` and `country` columns of the cost-of-living CSV.
2. If `cities_master.csv` exists, compute the set difference to find only new cities needing geocoding.
3. For each new city, query Nominatim with the string `"{city}, {country}"`, record the returned latitude and longitude rounded to 4 decimal places, sleep 1 second between requests to comply with Nominatim's usage policy. Store `null` coordinates for cities not found.
4. Concatenate new results with any previously geocoded rows, deduplicate on `(city, country)`, and write to `data/processed/cities_master.csv`.
**External APIs:** Nominatim (OpenStreetMap geocoding) -- resolves city name + country to WGS-84 lat/lon coordinates. No API key required. User-agent: `europe-climate-bi/1.0`.
**Notes:** Must be run before `fetch_projections.py` and `build_city_dataset.py`. Cities with null coordinates are silently skipped by the subsequent scripts.

---

### Stage 2: Fetch Climate Projections

**Script/File:** `scripts/fetch_projections.py`
**How to run:** `python scripts/fetch_projections.py` from the repo root with `.venv` activated. First run takes 10–30 minutes depending on API response time. Incremental re-runs for no new cities finish instantly.
**Reads:**
- `data/processed/cities_master.csv` -- geocoded city list (must exist; run Stage 1 first). Cities with null coordinates are skipped.
- `data/processed/climate_projections.csv` -- (optional) previously computed projections; if present, only the diff is fetched.
- `data/cache/openmeteo.sqlite` -- HTTP response cache (created automatically, expires after 24 hours) so re-runs within a day avoid re-fetching.
**Writes:**
- `data/processed/climate_projections.csv` -- one row per city with columns: `city`, `country`, `lat`, `lon`, `baseline_temp_c`, `future_temp_c`, `delta_temp_c`, `delta_summer_temp_c`, `delta_precip_pct`, `baseline_heat_days`, `future_heat_days`, `delta_heat_days`.
- `data/cache/openmeteo.sqlite` -- SQLite response cache written by `requests_cache`.
**Steps:**
1. Load cities with valid coordinates; compute the diff against any existing projections CSV.
2. Issue a single batch request to the Open-Meteo Climate API for all cities needing projections, requesting daily `temperature_2m_mean`, `temperature_2m_max`, and `precipitation_sum` from 1991-01-01 to 2050-12-31 across four GCMs: `CMCC_CM2_VHR4`, `EC_Earth3P_HR`, `MPI_ESM1_2_XR`, `MRI_AGCM3_2_S`.
3. For each city, average the four model responses into a single ensemble-mean daily time series.
4. Split into baseline (1991-2020) and future (2040-2050) periods. Compute: annual mean temperature for each period and their delta; June-July-August mean temperature delta; percentage change in mean annual precipitation total; mean annual count of days with daily max > 35°C for each period and their delta.
5. Guard against a response count mismatch (expected = cities × 4 models); abort rather than corrupt the ensemble means.
6. Append new results to any existing projections, deduplicate, and write to `data/processed/climate_projections.csv`.
**External APIs:** Open-Meteo Climate API (`https://climate-api.open-meteo.com/v1/climate`) -- returns historical and projected daily climate data from bias-corrected CMIP6 GCMs. Free, no API key required. Responses are cached in `data/cache/openmeteo.sqlite` for 24 hours.
**Notes:** Must be run before `build_city_dataset.py`. The cache file (`data/cache/`) is gitignored. On a clean clone the full fetch must run before `build_city_dataset.py` can produce complete data.

---

### Stage 3: Build and Export City JSON

**Script/File:** `scripts/build_city_dataset.py`
**How to run:** `python scripts/build_city_dataset.py` from the repo root with `.venv` activated. No API calls; completes in seconds. Safe to re-run after changing the resilience formula or cost-of-living data.
**Reads:**
- `data/raw/cost-of-living.csv` -- 231 cities with Numbeo cost-of-living metrics (index, rents, transport, food prices, etc.). Gitignored.
- `data/processed/cities_master.csv` -- geocoordinates from Stage 1.
- `data/processed/climate_projections.csv` -- climate deltas from Stage 2.
**Writes:**
- `data/processed/cities_all.json` -- compact JSON array of 231 city objects (~140 KB). Each object contains identity fields, all cost-of-living metrics, all climate projection fields, `resilience_score` (0-100), and `risk_tier`.
- `web/public/data/cities_all.json` -- mirror copy written automatically. If `web/public/data/` is absent the copy is skipped with a warning.
**Steps:**
1. Load all three input files; strip whitespace from city/country columns in the cost CSV.
2. Compute four vulnerability sub-scores via min-max normalization (0 = least vulnerable city, 100 = most vulnerable): one each for `delta_temp_c`, `delta_summer_temp_c`, `|delta_precip_pct|` (absolute value, treating both drying and flooding as bad), and `delta_heat_days`.
3. Average the four sub-scores into a single vulnerability score; invert to get `resilience_score = 100 − vulnerability`, rounded to one decimal place.
4. Assign `risk_tier` by threshold: ≥75 = "Low Risk", ≥50 = "Moderate Risk", ≥25 = "High Risk", <25 = "Critical".
5. Left-join `cities_master` with cost data on `(city, country)`, then left-join with the projection/resilience data.
6. Replace NaN with `None` for clean JSON serialization; round all numeric columns to 2 decimal places.
7. Serialize to compact JSON (no whitespace) and write both output paths.
**External APIs:** none
**Notes:** Resilience scores are relative to the current dataset -- they will shift if cities are added or removed. The `cities_all.json` file is committed to the repo so the frontend works on a clean clone without re-running the pipeline.

---

## Gaps and Manual Steps

- **ERA5 raw files must be downloaded manually.** The two NetCDF files (~4 GB combined) are gitignored and must be obtained from the Copernicus Climate Data Store before Pipeline A can run. No download script exists in the repo.
- **`data/raw/cost-of-living.csv` must be obtained manually.** The Numbeo cost-of-living CSV is gitignored. No script fetches or updates it. If Numbeo data changes, the file must be replaced by hand and Pipeline B re-run from Stage 1.
- **Pipeline A auto-copy may silently skip.** If `web/public/data/` is absent (e.g., on a fresh clone before `npm install` has run), `process_era5.py` emits a warning and skips the web copy. The developer must then copy `data/processed/climate_normals/` to `web/public/data/climate_normals/` manually.
- **No orchestration script.** There is no Makefile, shell script, or DAG that runs the full pipeline end-to-end. The four scripts must be invoked individually in the documented order.
- **No notebook pipeline.** The original one-shot notebook (`notebooks/01_explore_era5.ipynb`) referenced in older commits has been deleted; all pipeline logic now lives exclusively in the four `scripts/` files.
- **Open-Meteo cache is ephemeral.** The SQLite response cache in `data/cache/openmeteo.sqlite` expires after 24 hours and is gitignored. A full re-fetch of all 230 cities takes 10–30 minutes on a clean environment.
- **Pristina / Kosovo missing coordinates.** Nominatim cannot resolve "Pristina, Kosovo (Disputed Territory)". This city is present in the cost-of-living CSV but has null lat/lon in `cities_master.csv` and is excluded from climate projections and the final `cities_all.json`.
- **Resilience scores are dataset-relative.** Adding or removing cities changes all scores. There is no pinned baseline; consumers should treat scores as relative rankings, not absolute measures.
